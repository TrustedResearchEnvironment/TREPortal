from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Query, status
from sqlalchemy import cast, Integer, func, or_ # Make sure to import 'func' and 'or_'
from typing import List, Optional
from fastapi import Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from app.VerifyHeaders import verify_headers
from . import dbtables, config 
import models.models as models
from models.models import _INT32_POS
import database
from .helper  import get_paged_result
import hashlib
import json
import pandas as pd
import io
import base64
import hmac
import os

from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
from openpyxl.styles import Protection


def verify_metadata_integrity(df_metadata: pd.DataFrame) -> bool:
    """
    Verifies that the metadata has not been tampered with.
    Since we don't store the random password in the sheet, the server 
    must use its own SECRET_KEY to sign the metadata.
    """
    if "_VerificationHash" not in df_metadata.columns:
        return False
    
    # Use the server's master secret key
    secret_key_str = os.environ.get('HMAC_KEY')
    SECRET_KEY = secret_key_str.encode('utf-8')

    # 1. Extract the original signature from the sheet
    original_signature = df_metadata["_VerificationHash"].iloc[0]
    
    # 2. Extract remaining metadata and convert to dictionary
    metadata_dict = df_metadata.drop(columns=["_VerificationHash"]).iloc[0].to_dict()
    
    # 3. Normalize all values to strings for consistent hashing
    normalized_dict = {}
    for k, v in metadata_dict.items():
        if pd.isna(v):
            normalized_dict[k] = ""
        elif isinstance(v, bool):
            normalized_dict[k] = "TRUE" if v else "FALSE"
        # elif isinstance(v, (int, float)):
        #     normalized_dict[k] = str(v).rstrip('0').rstrip('.')
        elif isinstance(v, float):
            s = str(v)
            if '.' in s:
                s = s.rstrip('0').rstrip('.')
            normalized_metadata[k] = s
        else:
            normalized_dict[k] = str(v)
    
    # 4. Recalculate signature using the master SECRET_KEY
    recalculated_json = json.dumps(normalized_dict, sort_keys=True)
    # SECRET_KEY is already bytes from the encode() call above
    recalculated_signature = hmac.new(SECRET_KEY, recalculated_json.encode('utf-8'), hashlib.sha256).hexdigest()
    
    # 5. Compare signatures
    return hmac.compare_digest(recalculated_signature, original_signature)

router = APIRouter(
    prefix="/api/DataSetColumns",
    tags=["DataSetColumns"],
)

class ExcelVerificationRequest(models.BaseModel):
    fileData: str # The base64 string of the ENTIRE excel file


@router.post("/verify-integrity")
async def verify_excel_integrity(
    request: ExcelVerificationRequest,
    db: Session = Depends(database.get_db)
):
    """
    Endpoint to verify the integrity of an uploaded Excel file.
    Expects a base64 encoded string of the WHOLE file.
    """
    try:
        # 1. Decode the base64 string
        # If the string contains the 'data:application/...' prefix, remove it.
        base64_data = request.fileData
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]
            
        excel_binary = base64.b64decode(base64_data)
        
        # 2. Read the metadata sheet into a DataFrame from the binary
        # explicitly specify the engine as 'openpyxl' for .xlsx files
        df_meta = pd.read_excel(
            io.BytesIO(excel_binary), 
            sheet_name='DataSetMetadata',
            engine='openpyxl'
        )
        
        # 3. Call the integrity check function
        is_valid = verify_metadata_integrity(df_meta)
        
        if not is_valid:
            return {
                "status": "error",
                "valid": False,
                "message": "Security Alert: Metadata tampering detected. This file is invalid."
            }
            
        return {
            "status": "success",
            "valid": True,
            "message": "File integrity verified successfully."
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Verification failed: {str(e)}"
        )



@router.post("/download-excel")
async def download_excel(
    data: models.DataSetCreate
):
    # 0. Generate a random secure password for this specific export
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits
    secure_password = ''.join(secrets.choice(alphabet) for i in range(16))
    print(f"  [SECURITY] Generated secure password for DataSet {data.DataSetID}: {secure_password}")

    # 1. Convert nested columns to DF
    # Use .model_dump() for Pydantic v2 compatibility
    df_columns = pd.DataFrame([
        c.model_dump() if hasattr(c, 'model_dump') else c 
        for c in data.DataSetColumns
    ]).drop(columns=["TokenIdentifierType", "DisplayOrder", "IsFilter"], errors='ignore')
    
    # Rename Tokenise to Deidentify
    df_columns.rename(columns={"Tokenise": "Deidentify"}, inplace=True)
    
    # Reorder columns to put Deidentify (formerly Tokenise) at the end
    cols = list(df_columns.columns)
    if "Deidentify" in cols:
        cols.append(cols.pop(cols.index("Deidentify")))
        df_columns = df_columns[cols]
    

    # 2. Extract top-level metadata (excluding the list of columns)
    metadata = data.model_dump()
    metadata.pop("DataSetColumns", None)

    # Ensure DataSetID is included in metadata. Use only the top-level
    # `DataSetID` from the main payload (`data`). Do NOT infer from columns.
    metadata["DataSetID"] = getattr(data, "DataSetID", metadata.get("DataSetID"))

    # NORMALIZE metadata values to strings for consistent hashing
    normalized_metadata = {}
    for k, v in metadata.items():
        if v is None or (isinstance(v, float) and pd.isna(v)):
            normalized_metadata[k] = ""
        elif isinstance(v, bool):
            normalized_metadata[k] = "TRUE" if v else "FALSE"
        # elif isinstance(v, (int, float)):
        #     # Remove trailing zeros and decimal point for integers
        #     normalized_metadata[k] = str(v).rstrip('0').rstrip('.')
        elif isinstance(v, float):
            s = str(v)
            if '.' in s:
                s = s.rstrip('0').rstrip('.')
            normalized_metadata[k] = s 
        else:
            normalized_metadata[k] = str(v)
    
    # Generate signature using the master SECRET_KEY. 
    # We do NOT use the random secure_password for HMAC so that verify can work without it.
    MASTER_SECRET_KEY = os.environ.get('HMAC_KEY')
    metadata_json = json.dumps(normalized_metadata, sort_keys=True)
    signature = hmac.new(MASTER_SECRET_KEY.encode(), metadata_json.encode(), hashlib.sha256).hexdigest()

    # Flattening the metadata into a single-row DataFrame
    df_metadata = pd.DataFrame([metadata])
    # The signature itself is stored, but the password is NOT stored in the file.
    df_metadata["_VerificationHash"] = signature

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df_columns.to_excel(writer, index=False, sheet_name='DataSetColumns')
        df_metadata.to_excel(writer, index=False, sheet_name='DataSetMetadata')
        # Auto-size columns on the DataSetColumns sheet
        try:
            ws_size = writer.sheets.get('DataSetColumns')
            if ws_size is not None:
                for col_cells in ws_size.columns:
                    max_length = 0
                    col_letter = get_column_letter(col_cells[0].column)
                    for cell in col_cells:
                        try:
                            cell_len = len(str(cell.value)) if cell.value is not None else 0
                            if cell_len > max_length:
                                max_length = cell_len
                        except Exception:
                            pass
                    # Add padding and cap at a sensible max width
                    adjusted_width = min(max_length + 4, 80)
                    ws_size.column_dimensions[col_letter].width = adjusted_width
        except Exception:
            pass

        # Apply Data Validation to `DataSetColumns` sheet columns F and G
        try:
            ws = writer.sheets.get('DataSetColumns')
            if ws is not None:
                # Limit validation to the actual data rows written by pandas
                n_rows = getattr(df_columns, 'shape', (0, 0))[0]
                if n_rows > 0:
                    # header is row 1, data starts at row 2
                    end_row = 1 + n_rows

                    dv = DataValidation(
                        type='list',
                        formula1='"TRUE,FALSE"',
                        allow_blank=False,
                        showErrorMessage=True,
                        errorTitle='Invalid value',
                        error='Only TRUE or FALSE are allowed in this column',
                        showInputMessage=True,
                        prompt='Select either TRUE or FALSE from the dropdown'
                    )
                    dv.errorStyle = 'stop'
                    ws.add_data_validation(dv)
                    dv.add(f"F2:F{end_row}")
                    dv.add(f"G2:G{end_row}")

                    # Apply 500-character limit to Logical Name, Business Description, Example Value
                    _cols = list(df_columns.columns)
                    for _field in ["LogicalColumnName", "BusinessDescription", "ExampleValue"]:
                        if _field in _cols:
                            _col_letter = get_column_letter(_cols.index(_field) + 1)
                            dv_len = DataValidation(
                                type="textLength",
                                operator="lessThanOrEqual",
                                formula1="500",
                                allow_blank=True,
                                showErrorMessage=True,
                                errorTitle="Too long",
                                error=f"{_field.replace('LogicalColumnName','Logical Name').replace('BusinessDescription','Business Description').replace('ExampleValue','Example Value')} cannot exceed 500 characters.",
                            )
                            dv_len.errorStyle = "stop"
                            ws.add_data_validation(dv_len)
                            dv_len.add(f"{_col_letter}2:{_col_letter}{end_row}")

                    # Prevent any non-blank entries past the last written row
                    n_cols = getattr(df_columns, 'shape', (0, 0))[1]
                    if n_cols > 0:
                        last_col = get_column_letter(n_cols)
                        start_block_row = end_row + 1
                        EXCEL_MAX_ROW = 1048576
                        # Formula: allow entry only if the row is within the written
                        # area OR the current cell is blank. Use R1C1-style
                        # relative reference via INDIRECT("RC",FALSE) so Excel
                        # evaluates the current cell for each position.
                        block_formula = f'=OR(ROW()<={end_row},ISBLANK(INDIRECT("RC",FALSE)))'
                        dv_block = DataValidation(
                            type='custom',
                            formula1=block_formula,
                            allow_blank=True,
                            showErrorMessage=True,
                            errorTitle='No data allowed',
                            error='Entering data past the last row is not allowed',
                        )
                        dv_block.errorStyle = 'stop'
                        ws.add_data_validation(dv_block)
                        dv_block.add(f"A{start_block_row}:{last_col}{EXCEL_MAX_ROW}")
                        # Also prevent any entries in columns beyond the last used
                        # column across all rows (only blanks allowed).
                        MAX_EXCEL_COL = 16384
                        if n_cols < MAX_EXCEL_COL:
                            next_col = get_column_letter(n_cols + 1)
                            max_col_letter = get_column_letter(MAX_EXCEL_COL)
                            dv_cols = DataValidation(
                                type='custom',
                                formula1='=ISBLANK(INDIRECT("RC",FALSE))',
                                allow_blank=True,
                                showErrorMessage=True,
                                errorTitle='No data allowed',
                                error='Entering data past the last column is not allowed',
                            )
                            dv_cols.errorStyle = 'stop'
                            ws.add_data_validation(dv_cols)
                            dv_cols.add(f"{next_col}2:{max_col_letter}{EXCEL_MAX_ROW}")
                    
                    # Re-lock specific columns and header using Data Validation "Stop" errors
                    # instead of Sheet Protection, to allow more natural navigation.
                    try:
                        # 1. Block edits on Header Row (Row 1)
                        # We use a custom validation that checks if the cell's current content 
                        # matches its original content. Since we've already written the headers,
                        # any manual change will trigger the 'Stop' error.
                        # Formula: ="fixed_header_name" - we use R1C1 notation to compare value to itself
                        dv_header = DataValidation(
                            type="custom",
                            formula1='=FALSE', # Simplest way to block any entry/edit
                            showErrorMessage=True,
                            errorTitle='Read-only Header',
                            error='You cannot edit the header row.',
                        )
                        dv_header.errorStyle = 'stop'
                        ws.add_data_validation(dv_header)
                        dv_header.add(f"A1:{last_col}1")

                        # 2. Block edits on Column 1 (A) and Column 2 (B) for data rows
                        dv_id_cols = DataValidation(
                            type="custom",
                            formula1='=FALSE', # Force failure on any manual entry
                            showErrorMessage=True,
                            errorTitle='Read-only Column',
                            error='This column is generated automatically and cannot be edited.',
                        )
                        dv_id_cols.errorStyle = 'stop'
                        ws.add_data_validation(dv_id_cols)
                        dv_id_cols.add(f"A2:B{end_row}")

                        # Lock header and read-only columns to prevent paste-overwrites
                        try:
                            _cols_all = list(df_columns.columns)
                            lock_fields = ["ColumnName", "ColumnType"]
                            # Ensure header row is locked
                            for c_idx in range(1, n_cols + 1):
                                hdr_cell = ws[f"{get_column_letter(c_idx)}1"]
                                hdr_cell.protection = Protection(locked=True)

                            # Lock or unlock data cells per column
                            for r in range(2, end_row + 1):
                                for idx, col_name in enumerate(_cols_all, start=1):
                                    cell = ws[f"{get_column_letter(idx)}{r}"]
                                    if col_name in lock_fields:
                                        cell.protection = Protection(locked=True)
                                    else:
                                        # editable cells should be unlocked so users can type
                                        cell.protection = Protection(locked=False)

                            # Protect the worksheet so locked cells cannot be modified (prevents paste into locked cells)
                            # formatColumns=False allows users to manually resize columns
                            ws.protection.set_password(secure_password)
                            ws.protection.sheet = True
                            ws.protection.formatColumns = False
                        except Exception:
                            pass
                    except Exception:
                        pass
        except Exception:
            # Don't fail the export if data validation cannot be applied
            pass

        # Hide and protect the metadata sheet
        try:
            ws_meta = writer.sheets.get('DataSetMetadata')
            if ws_meta is not None:
                # 1. Protect with the per-file secure password
                ws_meta.protection.set_password(secure_password)
                ws_meta.protection.sheet = True

                # 2. Make it 'veryHidden' so it cannot be unhidden via Excel UI
                ws_meta.sheet_state = 'veryHidden'
                
                # 3. Lock the workbook structure using the same secure password
                writer.book.security.workbookPassword = secure_password
                writer.book.security.lockStructure = True
        except Exception:
            pass

    # 1. Convert binary to Base64 String
    binary_content = buffer.getvalue()
    base64_content = base64.b64encode(binary_content).decode('utf-8')

    # 2. Return as a standard JSON object (The wrapper will love this)
    return {
        "status": "success",
        "filename": "export.xlsx",
        "fileData": base64_content
    }


@router.get("/DataSetID/{data_set_id}", response_model=models.DataSetColumnPagedResult)
async def get_all_datasetcolumns_by_datasetid(
    data_set_id: _INT32_POS,
    page: int,
    pageSize: int = 10,
    search: str = Query(None), # <-- 1. Accept the search parameter
    db: Session = Depends(database.get_db)
):
    # 1. Fetch the data from the database (same as before)
    query = db.query(dbtables.DataSetColumn).filter(
                dbtables.DataSetColumn.DataSetID == data_set_id
            )
    db_columns = query.all()
    
    # 2. Manually convert each SQLAlchemy object into a Pydantic object
    results_as_dicts = [
        {
            "DataSetColumnID": db_obj.DataSetColumnID,
            "DataSetID": db_obj.DataSetID,
            "ColumnName": db_obj.ColumnName,
            "ColumnType": db_obj.ColumnType,
            "LogicalColumnName": db_obj.LogicalColumnName,
            "BusinessDescription": db_obj.BusinessDescription,
            "ExampleValue": db_obj.ExampleValue,
            "Deidentify": db_obj.Deidentify,
            "TokenIdentifierType": db_obj.TokenIdentifierType,
            "Redact": db_obj.Redact,
            "DisplayOrder": db_obj.DisplayOrder,
            "IsFilter": db_obj.IsFilter,
        }
        for db_obj in db_columns
    ]

    # 3. Return the new list of correctly structured dictionaries
    return get_paged_result(results_as_dicts, page, pageSize)

@router.post("/{data_set_id}", response_model=List[models.DataSetColumn])
async def create_or_update_datasetcolumns(
    data_set_id: _INT32_POS,
    columns_payload: List[models.DataSetColumn], # The list of columns from the front-end
    db: Session = Depends(database.get_db),
    auth_info: dict = Depends(verify_headers) # Assuming auth is needed
):
    """
    Handles a batch create and update (upsert) for DataSetColumn records.

    - Iterates through a list of column objects.
    - If a column has an 'Id', it updates the existing record.
    - If a column's 'Id' is null, it creates a new record.
    - All operations are performed within a single database transaction.
    """
    processed_columns = []
    
    try:
        for col_data in columns_payload:
            # --- UPDATE PATH ---
            if col_data.DataSetColumnID:
                # Fetch the existing column from the database
                db_column = db.query(dbtables.DataSetColumn).filter(
                    dbtables.DataSetColumn.DataSetColumnID == col_data.DataSetColumnID
                ).first()

                if not db_column:
                    # If an ID is provided but not found, it's a client error
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"DataSetColumn with ID {col_data.DataSetColumnID} not found."
                    )
                
                # Update the fields from the payload
                db_column.LogicalColumnName = col_data.LogicalColumnName
                db_column.BusinessDescription = col_data.BusinessDescription
                db_column.ExampleValue = col_data.ExampleValue
                db_column.Redact = col_data.Redact
                db_column.Deidentify = col_data.Deidentify
                db_column.IsFilter = col_data.IsFilter

            # --- CREATE PATH ---
            else:
                # Create a new SQLAlchemy object
                db_column = dbtables.DataSetColumn(
                    DataSetID=data_set_id, # Link to the parent Data Set
                    ColumnName=col_data.ColumnName,
                    ColumnType=col_data.ColumnType,
                    LogicalColumnName=col_data.LogicalColumnName,
                    BusinessDescription=col_data.BusinessDescription,
                    ExampleValue=col_data.ExampleValue,
                    Redact=col_data.Redact,
                    Deidentify=col_data.Deidentify,
                    IsFilter=col_data.IsFilter,
                    # Set defaults for other fields if necessary
                )
                db.add(db_column)

            processed_columns.append(db_column)

        # If the loop completes without errors, commit the transaction
        print("  -> Committing transaction to database...")
        db.commit()
        print("  -> Commit successful.")

        # Refresh each object to get the latest state from the DB (e.g., new IDs)
        for col in processed_columns:
            db.refresh(col)

    except SQLAlchemyError as e:
        # If any database error occurs, roll back the entire transaction
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"A database error occurred: {str(e)}"
        )
    except HTTPException as e:
        # Re-raise HTTPExceptions (like the 404) so FastAPI handles them
        db.rollback()
        raise e

    # Return the list of created/updated columns
    return processed_columns

@router.get("/Datetime/DataSetID/{data_set_id}", response_model=List[dict])
async def get_all_datetime_datasetcolumns_by_datasetid(
    data_set_id: _INT32_POS,
    db: Session = Depends(database.get_db)
):
    # 1. Fetch the data from the database (same as before)
    query = db.query(dbtables.DataSetColumn).filter(
                dbtables.DataSetColumn.DataSetID == data_set_id,
                # and if ColumnType is datetime or date
                or_(
                    dbtables.DataSetColumn.ColumnType == 'datetime',
                    dbtables.DataSetColumn.ColumnType == 'date'
                )
            )
    db_columns = query.all()
    
    # 2. Manually convert each SQLAlchemy object into a dictionary with only the required fields
    results_as_dicts = [
        {
            "DataSetColumnID": db_obj.DataSetColumnID,
            "ColumnName": db_obj.ColumnName
        } for db_obj in db_columns
    ]

    # 3. Return the new list of correctly structured dictionaries
    return results_as_dicts
