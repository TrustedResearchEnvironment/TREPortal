from fastapi import APIRouter, Depends, HTTPException, Query, status, Security, BackgroundTasks
from sqlalchemy.orm import selectinload 
from sqlalchemy import text, func, or_ # Make sure to import 'func' and 'or_'
from typing import List, Optional, Annotated
from sqlalchemy.orm import Session
import logging
_logger = logging.getLogger(__name__)
from datetime import datetime
# from fastapi.security import APIKeyHeader
from app.VerifyHeaders import verify_headers
from app.audit import audit
import requests
import json
from .helper  import get_paged_result
from . import dbtables
from PortalLib.CatalogueLib import *


import models.models as models
from models.models import _INT32_POS
from .dbtables import (
    DataSet, 
    DataSetFieldValue, 
    DataSetMetaDataValue, 
    DataSetColumn, 
    DataSetFolder,
    DataSetFolderFile,
    LoomeDataSourceTables, 
    LoomeDataSourceFolders, 
    MetaDataTokens,
    Field,
    RequestFilterValue
)

import database
 
router = APIRouter(
    prefix="/api/DataSet",
    tags=["DataSet"],
)


@router.get("", response_model=models.DataSetPagedResult)
async def get_all_datasets(
    page: int = 1,
    pageSize: int = 5,
    search: str = Query(None),
    name: Optional[str] = None,
    activeStatus: int = 3, #3 is both active and inactive; 1 is active; 2 is inactive
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    
    # Validation
    if activeStatus not in [0, 1, 2, 3]:
        raise HTTPException(status_code=400, detail="activeStatus must be 0, 1, 2, or 3")

    # --- 1. Build the base query and apply filters ---
    if activeStatus == 1:
        query = db.query(DataSet).filter(DataSet.IsActive == 1)
    elif activeStatus == 0:
        query = db.query(DataSet).filter(DataSet.IsActive == 0)
    else:
        query = db.query(DataSet).filter(DataSet.IsActive != 2)

    
    # --- 2. Apply search filter if provided ---
    if search:
        lower_search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(DataSet.Name).like(lower_search_term),
                func.lower(DataSet.Description).like(lower_search_term)
            )
        ) 
    
    
    results = [
        models.DataSet(
            # Fields from the DataSet class
            DataSetID=ds.DataSetID,
            ModifiedDate=ds.ModifiedDate,

            # Fields inherited from the DataSetBase class
            Name=ds.Name,
            Description=ds.Description,
            DataSourceID=ds.DataSourceID,
            IsActive=ds.IsActive,
            Approvers=ds.Approvers,
            OptOutMessage=ds.OptOutMessage,
            OptOutList=ds.OptOutList,
            Owner=ds.Owner,
            OptOutColumn=ds.OptOutColumn
        )
        for ds in query.all()
    ]
    print("Result Length:", len(results))
    
    # Return the response. 'total_count' will now be correct for the filtered data.
    return get_paged_result(results, page, pageSize)



@router.get("/{id}", response_model=models.DataSet)
async def get_dataset_by_id(id: int, 
                    auth_info: dict = Depends(verify_headers),
                    db: Session = Depends(database.get_db),
                             ):
    dataset = (
        db.query(DataSet)
        .filter(DataSet.DataSetID == id)
        .first()
    )
    
    if not dataset:
        raise HTTPException(status_code=404, detail="DataSet not found")
    
    # Load related data
    dataset_with_relations = (
        db.query(DataSet)
        .filter(DataSet.DataSetID == id)
        .join(DataSetFieldValue, DataSet.DataSetID == DataSetFieldValue.DataSetID, isouter=True)
        .join(DataSetMetaDataValue, DataSet.DataSetID == DataSetMetaDataValue.DataSetID, isouter=True)
        .join(DataSetColumn, DataSet.DataSetID == DataSetColumn.DataSetID, isouter=True)
        .join(DataSetFolder, DataSet.DataSetID == DataSetFolder.DataSetID, isouter=True)
        .join(DataSetFolderFile, DataSetFolder.DataSetFolderID == DataSetFolderFile.DataSetFolderID, isouter=True)
        .first()
    )
    
    # Convert the single dataset to a list containing only that dataset
    # Then use the helper function to wrap it in a paged result
    return dataset_with_relations


@router.get("/{id}/columns", response_model=models.DataSetColumnPagedResult)
async def get_dataset_columns(
    id: _INT32_POS, 
    page: int = 1,
    page_size: int = 5,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    query = db.query(DataSetColumn).filter(DataSetColumn.DataSetID == id)
    total_count = query.count()
    print("Total count of columns:", total_count)
    
    # Add explicit ordering by primary key to satisfy SQL Server's requirement
    # columns = query.order_by(DataSetColumn.DisplayOrder).offset((page - 1) * page_size).limit(page_size).all()
    columns = query.order_by(DataSetColumn.DisplayOrder).all()
   
    results = []
    for column in columns:
        results.append(models.DataSetColumn(
            # Change from lowercase to uppercase field names to match your Pydantic model
            DataSetColumnID=column.DataSetColumnID,
            DataSetID=column.DataSetID,
            ColumnName=column.ColumnName,
            ColumnType=column.ColumnType,
            LogicalColumnName=column.LogicalColumnName,
            BusinessDescription=column.BusinessDescription,
            ExampleValue=column.ExampleValue,
            Deidentify=column.Deidentify,
            TokenIdentifierType=column.TokenIdentifierType,
            Redact=column.Redact,
            DisplayOrder=column.DisplayOrder,
            IsFilter=column.IsFilter
        ))
    
    # Match the expected model field names
    return get_paged_result(results, page, total_count)

# Miguel:
@router.post("/{id}/Request", response_model=models.Request)
async def post_dataset_request(
    id: _INT32_POS,
    payload: models.DatasetRequestContent,
    # request_data: models.RequestCreate,  # Create a separate model for input data
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # Verify dataset exists
    dataset = db.query(DataSet).filter(DataSet.DataSetID == id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Verify request name is unique (excluding cancelled requests with StatusID=5)
    name_to_check = payload.requestName.strip().lower()
    existing_request = db.query(dbtables.Request).filter(
        func.lower(func.trim(dbtables.Request.Name)) == name_to_check,
        dbtables.Request.StatusID != 5
    ).first()
    if existing_request:
       
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A Request with the name '{payload.requestName}' already exists."
        )


    # Create a SQLAlchemy ORM model instance using data from the Pydantic model
    current_time = datetime.now()
    db_request = dbtables.Request(
        CreateUser=auth_info["upn"].lower(),
        ProjectID=payload.assistProjectID,
        Name=payload.requestName,
        StatusID=1, # Initial status ("Pending")
        DataSetID=id,
        Approvers=payload.approvers.lower(),
        CreateDate=current_time,
        Purpose=payload.purpose,
        ModifiedDate=current_time,
        ApprovedDate=None,
        RejectedDate=None,
        FinalisedDate=None,
        CurrentlyApproved=None,
        RejectedBy=None,
        ApprovalMessage=None,
        RejectionMessage=None,
        Orphaned=None
    )

    try:
        db.add(db_request)
        db.flush()  # Assigns RequestID without committing, so a later failure can still roll back

        # If payload.dateTimeFilters is not an empty list, push elements to dbo.RequestFilterValue
        if payload.dateTimeFilters:
            for filter in payload.dateTimeFilters:
                db_filter_value = RequestFilterValue(
                    RequestID=db_request.RequestID,
                    ColumnName=filter.field,
                    ColumnType="datetime",
                    FilterType="Between",
                    Value1=filter.fromDate,
                    Value2=filter.toDate
                )
                db.add(db_filter_value)

        # Build (and validate) the response payload before committing, so a Pydantic
        # error here still rolls back instead of leaving an already-committed row.
        response_model = models.Request(
            RequestID=db_request.RequestID,  # Make sure this line is included!
            Name=db_request.Name,
            Purpose=db_request.Purpose,
            CreateDate=db_request.CreateDate,
            CreateUser=db_request.CreateUser,
            ModifiedDate=db_request.ModifiedDate,
            StatusID=db_request.StatusID,
            ProjectID=db_request.ProjectID,
            DataSetID=db_request.DataSetID,
            Approvers=db_request.Approvers,
            ApprovedDate=db_request.ApprovedDate,
            RejectedDate=db_request.RejectedDate,
            RejectedBy=db_request.RejectedBy,
            FinalisedDate=db_request.FinalisedDate,
            CurrentlyApproved=db_request.CurrentlyApproved,
            ApprovalMessage=db_request.ApprovalMessage,
            RejectionMessage=db_request.RejectionMessage,
            Orphaned=db_request.Orphaned
        )

        db.commit()
    except Exception as e:
        db.rollback()
        # Keep the full error detail in the audit log; return a generic message to the client
        audit(
            event="dataset.request_create",
            action="create",
            result="failure",
            upn=auth_info["upn"],
            method="POST",
            path=f"/api/DataSet/{id}/Request",
            item_type="Request",
            status_code=400,
            error_code="CREATE_REQUEST_ERROR",
            error_message=str(e),
            project_id=payload.assistProjectID,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create the request. Please check your submission or contact a Data Administrator and try again."
        )

    audit(
        event="dataset.request_create",
        action="create",
        result="success",
        upn=auth_info["upn"],
        method="POST",
        path=f"/api/DataSet/{id}/Request",
        item_type="Request",
        item_id=db_request.RequestID,
        status_code=200,
        project_id=payload.assistProjectID,
    )

    return response_model


    
@router.post("/Create",
             response_model=models.DataSet,
             status_code=status.HTTP_200_OK)
async def create_dataset(
    dataset: models.DataSetCreate,
    db: Session = Depends(database.get_db)
):
    try:
        # --- Check if a Dataset with the same name already exists (excluding cancelled entries) ---
        name_to_check = dataset.Name.strip().lower()
        existing_dataset = db.query(DataSet).filter(
            func.lower(func.trim(DataSet.Name)) == name_to_check,
            DataSet.IsActive != 2
        ).first()
        if existing_dataset:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A Data Set with the name '{dataset.Name}' already exists."
            )

        # Start transaction
        db_dataset = DataSet(
            Name=dataset.Name,
            Description=dataset.Description,
            DataSourceID=dataset.DataSourceID,
            IsActive=dataset.IsActive,
            ModifiedDate=datetime.now(),
            Approvers=dataset.Approvers.lower(),
            OptOutMessage=dataset.OptOutMessage,
            OptOutList=dataset.OptOutList,
            Owner=dataset.Owner.lower(),
            OptOutColumn=dataset.OptOutColumn
        )
        
        db.add(db_dataset)
        db.flush()  # Get the ID while still in transaction
        
        # Create all related records
        for field_value in dataset.DataSetFieldValues:
            db_field_value = DataSetFieldValue(
                DataSetID=db_dataset.DataSetID,
                FieldID=field_value.FieldID,
                Value=field_value.Value
            )
            db.add(db_field_value)
        
        for metadata_value in dataset.DataSetMetaDataValues:
            db_metadata_value = DataSetMetaDataValue(
                DataSetID=db_dataset.DataSetID,
                MetaDataID=metadata_value.MetaDataID,
                Value=metadata_value.Value
            )
            db.add(db_metadata_value)
        
        # Add remaining related records with proper error handling
        data_source_type_id = int(dataset.DataSourceTypeID)
        try:
            # Add columns for SQL DB and REDCap
            if data_source_type_id in [1, 2]:
                for column in dataset.DataSetColumns:
                    db_column = DataSetColumn(
                        DataSetID=db_dataset.DataSetID,
                        ColumnName=column.ColumnName,
                        ColumnType=column.ColumnType,
                        LogicalColumnName=column.LogicalColumnName,
                        BusinessDescription=column.BusinessDescription,
                        ExampleValue=column.ExampleValue,
                        Deidentify=column.Deidentify,
                        TokenIdentifierType=column.TokenIdentifierType,
                        Redact=column.Redact,
                        DisplayOrder=column.DisplayOrder,
                        IsFilter=column.IsFilter
                    )
                    db.add(db_column)
                
            # Add folders and files
            elif data_source_type_id == 3:
                # Create a dictionary to map the folder name to its real database ID
                folder_name_to_id_map = {}

                # --- PASS 1: Create the unique folders and populate the map ---
                
                # Get a list of unique folder names from the files payload
                unique_folder_names = sorted(list(set(file.FolderName for file in dataset.DataSetFolderFiles)))

                for folder_name in unique_folder_names:
                    db_folder = DataSetFolder(
                        DataSetID=db_dataset.DataSetID,
                        FolderName=folder_name,
                        Description='' # You can derive this if needed
                    )
                    db.add(db_folder)
                    db.flush() # This generates the real, auto-incremented DataSetFolderID

                    # Map the string name to the new, real database ID
                    folder_name_to_id_map[folder_name] = db_folder.DataSetFolderID

                # --- PASS 2: Create the files using the map to get the correct foreign key ---
                if dataset.DataSetFolderFiles:
                    for file in dataset.DataSetFolderFiles:
                        # Look up the real DataSetFolderID from the map using the file's FolderName
                        parent_folder_id = folder_name_to_id_map.get(file.FolderName)

                        if parent_folder_id: # Safety check
                            db_file = DataSetFolderFile(
                                DataSetFolderID=parent_folder_id, # Use the REAL database ID
                                FileType=file.FileExtensions,
                                FileDescription=file.FileDescription,
                                Redact=file.Redact,
                                Deidentify=file.Deidentify,
                            )
                            db.add(db_file)

            # Commit all changes
            db.commit()
            
            # Execute stored procedure
            db.execute(text("EXEC sprSyncDataSetToPublish"))
            
            # Refresh to get all related data
            db.refresh(db_dataset)


            # PORTAL CATALOGUE ENTRY
            print("Creating catalogue entry for dataset:", db_dataset.Name)
            # get the datasource name from table DataSource using DataSourceID
            # datasource = db.query(dbtables.DataSource).filter(dbtables.DataSource.DataSourceID == str(db_dataset.DataSourceID)).first().Name
            datasourcetype = db.query(dbtables.DataSourceType).filter(dbtables.DataSourceType.DataSourceTypeID == str(db.query(dbtables.DataSource).filter(dbtables.DataSource.DataSourceID == str(db_dataset.DataSourceID)).first().DataSourceTypeID)).first().Name
            # print("Datasource:", datasource)
            print("Datasource Type:", datasourcetype)

            # MAP :  {'SQL Database': 59, 'REDCap Database': 60, 'Files': 61}
            #GET: Database; REDCap API; Folder

            # Add to catalogue
            # _replacement_dict = {
            #     "entity_type_name": datasourcetype,
            #     "_asset_name": db_dataset.Name,
            #     "_dataset_id": db_dataset.DataSetID,
            #     "_data_source": datasourcetype,
            #     "_tre_url": "none"
            # }
            _replacement_dict = {
                "entity_type_name": datasourcetype,
                "_name":  db_dataset.Name,
                "_sourceItemId": db_dataset.DataSetID,
                "_group": "TRE Data Assets",
                "_embeddingsDataSetID": db_dataset.DataSetID,
                "_embeddingsDataSetIDDescription": "Source Dataset identifier",
                "_actionsUrl": "None",
                "_actionsDescription": "Open",
                "_attributesDataSource": datasourcetype
                # Get
                # Add attributes in portal
                #link to entity
                # API - list artibutes
                # API - Add needs to check for existing 
                # Add is active bool to entity
                # # DO NOT USE 
                # "_entity_type_id": #, -- this must be looked up 
            }
            
            print("_replacement_dict:", _replacement_dict)
            submit_new_asset([_replacement_dict])
            print("Catalogue entry created successfully.")

            audit(
                event="dataset.create",
                action="create",
                result="success",
                upn=dataset.Owner,
                method="POST",
                path="/api/DataSet/Create",
                item_type="DataSet",
                item_id=db_dataset.DataSetID,
                status_code=200,
            )

            # Return a simplified dictionary instead of the full database object
            return {
                "DataSetID": db_dataset.DataSetID,
                "Name": db_dataset.Name,
                "Description": db_dataset.Description,
                "DataSourceID": db_dataset.DataSourceID,
                "IsActive": db_dataset.IsActive,
                "ModifiedDate": db_dataset.ModifiedDate,
                "Approvers": db_dataset.Approvers,
                "OptOutMessage": db_dataset.OptOutMessage,
                "OptOutList": db_dataset.OptOutList,
                "Owner": db_dataset.Owner,
                "OptOutColumn": db_dataset.OptOutColumn
            }
            
        except Exception as e:
            db.rollback()
            audit(
                event="dataset.create",
                action="create",
                result="failure",
                upn=dataset.Owner,
                method="POST",
                path="/api/DataSet/Create",
                item_type="DataSet",
                status_code=400,
                error_code="CREATE_RELATIONSHIP_ERROR",
                error_message=str(e),
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error creating dataset relationships: {str(e)}"
            )
            
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating dataset: {str(e)}"
        )

# @router.get(
#     "/UPN",
#     response_model=models.DataSet,
#     summary="Get all Data Set By UPN"
# )
# async def get_datasets_by_upn(
#     page: int = 1,
#     page_size: int = 5,
#     upn: str = None, 
#     auth_info: dict = Depends(verify_headers),
#     db: Session = Depends(database.get_db)
# ):

#     upn = auth_info["upn"]
#     print (f"UPN from headers: {upn}")

#     datasets = (
#         db.query(DataSet)
#         .filter(DataSet.Owner == upn)
#         .all()
#     )

#     results = [
#         models.DataSet(
#             DataSetID=d.DataSetID,
#             Name=d.Name,
#             Description=d.Description,
#             DataSourceID=d.DataSourceID,
#             IsActive=d.IsActive,
#             ModifiedDate=d.ModifiedDate,
#             Approvers=d.Approvers,
#             OptOutMessage=d.OptOutMessage,
#             OptOutList=d.OptOutList,
#             Owner=d.Owner,
#             OptOutColumn=d.OptOutColumn
#         ) for d in datasets
#     ]
    
#     print("Datasets found for UPN:", len(results)   )
#     return get_paged_result(results, page, page_size)


@router.put(
    "/Update/{id}",
    response_model=models.DataSet,
    summary="Update a Data Set and its fields"
)
async def update_dataset(
    id: _INT32_POS,
    dataset: models.DataSetCreate,
    db: Session = Depends(database.get_db)
):
    try:
        # Step 1: Update main DataSet record
        update_values = {
            "Name": dataset.Name,
            "Description": dataset.Description,
            "DataSourceID": dataset.DataSourceID,
            "IsActive": dataset.IsActive,
            "ModifiedDate": datetime.now(),
            "Approvers": dataset.Approvers.lower(),
            "OptOutMessage": dataset.OptOutMessage,
            "OptOutList": dataset.OptOutList,
            "Owner": dataset.Owner.lower(),
            "OptOutColumn": dataset.OptOutColumn
        }
        
        # Use update method with synchronize_session=False
        updated_row_count = (
            db.query(DataSet)
            .filter(DataSet.DataSetID == id)
            .update(update_values, synchronize_session=False)
        )
        
        # Check if update was successful
        if updated_row_count == 0:
            raise HTTPException(status_code=404, detail=f"DataSet with ID {id} not found")
        
        # Step 2: Fetch the updated dataset
        db_dataset = db.get(DataSet, id)
        if not db_dataset:
            raise HTTPException(status_code=404, detail="DataSet disappeared after update")
        
        # Step 3: Handle related records safely

        # --- Field Values ---
        if hasattr(dataset, "DataSetFieldValues") and dataset.DataSetFieldValues:
            # Only replace if new values exist
            db.query(DataSetFieldValue).filter(DataSetFieldValue.DataSetID == id).delete(synchronize_session=False)
            for field_value in dataset.DataSetFieldValues:
                db.add(DataSetFieldValue(
                    DataSetID=id,
                    FieldID=field_value.FieldID,
                    Value=field_value.Value
                ))
        else:
            print(f"No DataSetFieldValues provided — preserving existing entries for DataSetID {id}")

        # --- Metadata Values ---
        if hasattr(dataset, "DataSetMetaDataValues") and dataset.DataSetMetaDataValues:
            db.query(DataSetMetaDataValue).filter(DataSetMetaDataValue.DataSetID == id).delete(synchronize_session=False)
            for metadata_value in dataset.DataSetMetaDataValues:
                db.add(DataSetMetaDataValue(
                    DataSetID=id,
                    MetaDataID=metadata_value.MetaDataID,
                    Value=metadata_value.Value
                ))
        else:
            print(f"No DataSetMetaDataValues provided — preserving existing entries for DataSetID {id}")

        # --- Columns ---
        if hasattr(dataset, "DataSetColumns") and dataset.DataSetColumns:
            db.query(DataSetColumn).filter(DataSetColumn.DataSetID == id).delete(synchronize_session=False)
            for column in dataset.DataSetColumns:
                db.add(DataSetColumn(
                    DataSetID=id,
                    ColumnName=column.ColumnName,
                    ColumnType=column.ColumnType,
                    LogicalColumnName=column.LogicalColumnName,
                    BusinessDescription=column.BusinessDescription,
                    ExampleValue=column.ExampleValue,
                    Deidentify=column.Deidentify,
                    TokenIdentifierType=column.TokenIdentifierType,
                    Redact=column.Redact,
                    DisplayOrder=column.DisplayOrder,
                    IsFilter=column.IsFilter
                ))
        else:
            print(f"No DataSetColumns provided — preserving existing entries for DataSetID {id}")
        
        # Delete folder files first, then folders
        for folder in db.query(DataSetFolder).filter(DataSetFolder.DataSetID == id).all():
            db.query(DataSetFolderFile).filter(DataSetFolderFile.DataSetFolderID == folder.DataSetFolderID).delete(synchronize_session=False)
        db.query(DataSetFolder).filter(DataSetFolder.DataSetID == id).delete(synchronize_session=False)
        
        # Step 4: Add folder and file records
        if hasattr(dataset, "DataSetFolders") and dataset.DataSetFolders:
            for folder in dataset.DataSetFolders:
                db_folder = DataSetFolder(
                    DataSetID=id,
                    FolderName=folder.FolderName,
                    Description=folder.Description
                )
                db.add(db_folder)
                db.flush()  # Get the new folder ID
                
                for file in folder.DataSetFolderFiles:
                    db.add(DataSetFolderFile(
                        DataSetFolderID=db_folder.DataSetFolderID,
                        FileType=file.FileType,
                        FileDescription=file.FileDescription,
                        Redact=file.Redact,
                        Deidentify=file.Deidentify,
                    ))
        else:
            print(f"No DataSetFolders provided — preserving existing entries for DataSetID {id}")
        
        # Step 5: Commit transaction for related records
        db.commit()
        
        # Step 6: Execute sync procedure
        db.execute(text("EXEC sprSyncDataSetToPublish"))
        
        # Step 7: Refresh and return the dataset
        db.refresh(db_dataset)

        # Step 8: Update Catalogue Asset
        # PORTAL CATALOGUE ENTRY
        print("Updating catalogue entry for dataset:", db_dataset.Name)
        # get the datasource name from table DataSource using DataSourceID
        datasourcetype = db.query(dbtables.DataSourceType).filter(dbtables.DataSourceType.DataSourceTypeID == str(db.query(dbtables.DataSource).filter(dbtables.DataSource.DataSourceID == str(db_dataset.DataSourceID)).first().DataSourceTypeID)).first().Name
        print("Datasource Type:", datasourcetype)

        # MAP :  {'SQL Database': 59, 'REDCap Database': 60, 'Files': 61}
        #GET: Database; REDCap API; Folder

        # Build the replacement dict for the current dataset
        _replacement_dict = {
            "entity_type_name": datasourcetype,
            "_name":  db_dataset.Name,
            "_sourceItemId": db_dataset.DataSetID,
            "_group": "TRE Data Assets",
            "_embeddingsDataSetID": db_dataset.DataSetID,
            "_embeddingsDataSetIDDescription": "Source Dataset identifier",
            "_actionsUrl": "None",
            "_actionsDescription": "Open",
            "_attributesDataSource": datasourcetype
        }
        
        print("_replacement_dict:", _replacement_dict)
        submit_new_asset([_replacement_dict])
        print("Catalogue entry updated successfully.")

        audit(
            event="dataset.update",
            action="update",
            result="success",
            upn=dataset.Owner,
            method="PUT",
            path=f"/api/DataSet/Update/{id}",
            item_type="DataSet",
            item_id=id,
            status_code=200,
        )

        return db_dataset

    except Exception as e:
        db.rollback()
        audit(
            event="dataset.update",
            action="update",
            result="failure",
            upn=dataset.Owner if dataset else None,
            method="PUT",
            path=f"/api/DataSet/Update/{id}",
            item_type="DataSet",
            item_id=id,
            status_code=500,
            error_code="UPDATE_ERROR",
            error_message=str(e),
        )
        print(f"Error updating dataset: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    





@router.put("/{id}/Cancel", status_code=status.HTTP_202_ACCEPTED)
async def cancel_dataset(
    id: _INT32_POS,
    background_tasks: BackgroundTasks,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    """
    Marks a single DataSet as cancelled by setting IsActive to 2 instead of deleting.
    Also marks all related records (columns, fields, metadata, folders, and files) as cancelled.
    IsActive=2 indicates the DataSet and related records have been cancelled/deleted.
    """
    
    db_dataset = (
        db.query(DataSet)
        .filter(DataSet.DataSetID == id)
        .first()
    )
    
    if not db_dataset:
        raise HTTPException(status_code=404, detail=f"DataSet with ID {id} not found")

    # Soft delete: Mark all related records as cancelled (IsActive=2) instead of deleting them
    # IsActive=2 indicates records have been cancelled/deleted
    current_time = datetime.now()
    
    try:
        # 1. Mark Folder Files as cancelled
        db.query(DataSetFolderFile).filter(
            DataSetFolderFile.DataSetFolderID.in_(
                db.query(DataSetFolder.DataSetFolderID).filter(DataSetFolder.DataSetID == id)
            )
        ).update(
            {DataSetFolderFile.IsActive: 2, DataSetFolderFile.ModifiedDate: current_time},
            synchronize_session=False
        )
        
        # 2. Mark Folders as cancelled
        db.query(DataSetFolder).filter(DataSetFolder.DataSetID == id).update(
            {DataSetFolder.IsActive: 2, DataSetFolder.ModifiedDate: current_time},
            synchronize_session=False
        )
        
        # 3. Mark other related items as cancelled
        db.query(DataSetFieldValue).filter(DataSetFieldValue.DataSetID == id).update(
            {DataSetFieldValue.IsActive: 2, DataSetFieldValue.ModifiedDate: current_time},
            synchronize_session=False
        )
        db.query(DataSetMetaDataValue).filter(DataSetMetaDataValue.DataSetID == id).update(
            {DataSetMetaDataValue.IsActive: 2, DataSetMetaDataValue.ModifiedDate: current_time},
            synchronize_session=False
        )
        db.query(DataSetColumn).filter(DataSetColumn.DataSetID == id).update(
            {DataSetColumn.IsActive: 2, DataSetColumn.ModifiedDate: current_time},
            synchronize_session=False
        )
        
        # 4. Mark the primary DataSet record as cancelled
        db_dataset.IsActive = 2
        db_dataset.ModifiedDate = current_time
        db.commit()

        # 5.Delete from Portal catalogue


        # Delete from Portal by staging all OTHER active datasets
    
        # Get all active datasets except the one being deleted
        # active_datasets = db.query(DataSet).filter(
        #     DataSet.IsActive == 1,  # Only active (not cancelled)
        #     DataSet.DataSetID != id  # Exclude the one being deleted
        # ).all()
        
        # # Build replacement dicts for datasets to keep
        # _replacement_dict_list = []
        # for dataset in active_datasets:
        #     datasourcetype = db.query(dbtables.DataSourceType).filter(
        #         dbtables.DataSourceType.DataSourceTypeID == str(
        #             db.query(dbtables.DataSource).filter(
        #                 dbtables.DataSource.DataSourceID == str(dataset.DataSourceID)
        #             ).first().DataSourceTypeID
        #         )
        #     ).first().Name
            
        #     _replacement_dict = {
        #         "entity_type_name": datasourcetype,
        #         "_name": dataset.Name,
        #         "_sourceItemId": dataset.DataSetID,
        #         "_group": "TRE Data Assets",
        #         "_embeddingsDataSetID": dataset.DataSetID,
        #         "_embeddingsDataSetIDDescription": "Source Dataset identifier",
        #         "_actionsUrl": "None",
        #         "_actionsDescription": "Open",
        #         "_attributesDataSource": datasourcetype
        #     }
        #     _replacement_dict_list.append(_replacement_dict)
        # print("_replacement_dict_list for remaining datasets:", _replacement_dict_list)

        # # Wrap the sync in a background task so the response returns immediately.
        # # exponential_backoff=True prevents rate limit hammering during polling.
        # def _catalogue_sync_task(replacement_list, dataset_id, upn):
        #     try:
        #         submit_new_asset(replacement_list, keep_orphans=False, exponential_backoff=True)
        #         _logger.info(f"Background catalogue sync completed for DataSet {dataset_id}")
        #     except Exception as sync_exc:
        #         _logger.error(f"Background catalogue sync FAILED for DataSet {dataset_id}: {sync_exc}")
        #         audit(
        #             event="dataset.catalogue_sync", action="sync", result="failure",
        #             upn=upn, method="PUT", path=f"/api/DataSet/{dataset_id}/Cancel",
        #             item_type="DataSet", item_id=dataset_id, status_code=500,
        #             error_message=str(sync_exc),
        #         )

        # background_tasks.add_task(_catalogue_sync_task, _replacement_dict_list, id, auth_info["upn"])
    
        
        audit(
            event="dataset.cancel", action="cancel", result="success",
            upn=auth_info["upn"], method="PUT", path=f"/api/DataSet/{id}/Cancel",
            item_type="DataSet", item_id=id,
            status_code=200
        )
        return {
            "message": f"DataSet {id} and all related records marked as cancelled successfully"
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An error occurred during cancellation: {str(e)}")


# @router.get("/GetREDCapData", response_model=List[models.RedcapSharedMetaData])
# async def get_redcap_data(
#     apikey: str, 
#     datasourceid: int,
#     db: Session = Depends(database.get_db)
# ):
#     if not apikey:
#         return [{"field_label": "Invalid API Key"}]
    
#     try:
#         # In a real implementation, this would involve calling the REDCap API
#         # Here we're returning a mock response
        
#         # Mock implementation - in reality, you'd use a REDCap client library
#         # or make HTTP requests to the REDCap API
#         return [
#             {
#                 "field_name": "record_id",
#                 "form_name": "demographics",
#                 "section_header": "",
#                 "field_type": "text",
#                 "field_label": "Record ID",
#                 "select_choices_or_calculations": "",
#                 "field_note": "",
#                 "text_validation_type_or_show_slider_number": "",
#                 "text_validation_min": "",
#                 "text_validation_max": "",
#                 "identifier": "",
#                 "branching_logic": "",
#                 "required_field": "",
#                 "custom_alignment": "",
#                 "question_number": "",
#                 "matrix_group_name": "",
#                 "maxtrix_ranking": "",
#                 "field_annotation": ""
#             },
#             {
#                 "field_name": "name",
#                 "form_name": "demographics",
#                 "section_header": "Personal Information",
#                 "field_type": "text",
#                 "field_label": "Name",
#                 "select_choices_or_calculations": "",
#                 "field_note": "",
#                 "text_validation_type_or_show_slider_number": "",
#                 "text_validation_min": "",
#                 "text_validation_max": "",
#                 "identifier": "y",
#                 "branching_logic": "",
#                 "required_field": "y",
#                 "custom_alignment": "",
#                 "question_number": "1",
#                 "matrix_group_name": "",
#                 "maxtrix_ranking": "",
#                 "field_annotation": "PII"
#             },
#             {
#                 "field_name": "age",
#                 "form_name": "demographics",
#                 "section_header": "",
#                 "field_type": "text",
#                 "field_label": "Age",
#                 "select_choices_or_calculations": "",
#                 "field_note": "In years",
#                 "text_validation_type_or_show_slider_number": "integer",
#                 "text_validation_min": "0",
#                 "text_validation_max": "120",
#                 "identifier": "",
#                 "branching_logic": "",
#                 "required_field": "y",
#                 "custom_alignment": "",
#                 "question_number": "2",
#                 "matrix_group_name": "",
#                 "maxtrix_ranking": "",
#                 "field_annotation": ""
#             }
#         ]
#     except Exception as e:
#         raise HTTPException(
#             status_code=500, 
#             detail=f"Error fetching REDCap data: {str(e)}"
#         )
