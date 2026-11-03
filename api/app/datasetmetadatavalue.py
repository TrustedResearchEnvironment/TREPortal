from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List

# Import your project's modules
import database
from app.VerifyHeaders import verify_headers
from . import dbtables
import models.models as models
from models.models import _INT32_POS

# 1. Define the new router for this specific resource
router = APIRouter(
    prefix="/api/DataSetMetaDataValue",
    tags=["DataSetMetaDataValue"],
)

# 2. GET Endpoint: Get all metadata values for a given DataSetID
@router.get("/DataSetID/{data_set_id}", response_model=List[models.DataSetMetaDataValue])
async def get_all_metadatavalues_by_datasetid(
    data_set_id: _INT32_POS,
    db: Session = Depends(database.get_db)
):
    """
    Retrieves all DataSetMetadataValue records associated with a given DataSetID.
    """
    try:
        # Query the database for all records matching the DataSetID
        db_metadata_values = db.query(dbtables.DataSetMetaDataValue).filter(
            dbtables.DataSetMetaDataValue.DataSetID == data_set_id
        ).all()
        
        # 2. Manually convert each SQLAlchemy object into a dictionary
        #    This is necessary because orm_mode is not being used.
        results_as_dicts = [
            {
                "DataSetMetaDataValueID": db_obj.DataSetMetaDataValueID,
                "DataSetID": db_obj.DataSetID,
                "MetaDataID": db_obj.MetaDataID,
                "Value": db_obj.Value,
            }
            for db_obj in db_metadata_values
        ]
        
        # 3. Return the new list of correctly structured dictionaries
        return results_as_dicts
    
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"A database error occurred: {str(e)}"
        )


# 3. POST Endpoint: Create or Update metadata values in a batch
@router.post("/{data_set_id}", response_model=List[models.DataSetMetaDataValue])
async def create_or_update_metadatavalues(
    data_set_id: _INT32_POS,
    metadata_payload: List[models.DataSetMetaDataValue],
    db: Session = Depends(database.get_db),
    auth_info: dict = Depends(verify_headers)
):
    """
    Handles a batch create and update (upsert) for DataSetMetadataValue records.

    - For each item in the payload:
      - If 'DataSetMetaDataValueID' exists, it updates the record.
      - If 'DataSetMetaDataValueID' is null, it creates a new record.
    - All operations are performed within a single database transaction.
    """
    processed_metadata = []
    
    try:
        for meta_data in metadata_payload:
            # --- UPDATE PATH ---
            if meta_data.DataSetMetaDataValueID:
                db_metadata = db.query(dbtables.DataSetMetaDataValue).filter(
                    dbtables.DataSetMetaDataValue.DataSetMetaDataValueID == meta_data.DataSetMetaDataValueID
                ).first()

                if not db_metadata:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"DataSetMetadataValue with ID {meta_data.DataSetMetaDataValueID} not found."
                    )
                
                # Update the value. MetadataID should not be changed.
                db_metadata.Value = meta_data.Value

            # --- CREATE PATH ---
            else:
                # Create a new SQLAlchemy object
                db_metadata = dbtables.DataSetMetaDataValue(
                    DataSetID=data_set_id,
                    MetaDataID=meta_data.MetaDataID,
                    Value=meta_data.Value,
                )
                db.add(db_metadata)
            
            processed_metadata.append(db_metadata)

        # Commit the transaction to save all changes
        db.commit()

        # Refresh objects to get latest state from the DB (e.g., new IDs)
        for item in processed_metadata:
            db.refresh(item)

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"A database error occurred: {str(e)}"
        )
    except HTTPException as e:
        db.rollback()
        raise e

    results_as_dicts = [
        {
            "DataSetMetaDataValueID": db_obj.DataSetMetaDataValueID,
            "DataSetID": db_obj.DataSetID,
            "MetaDataID": db_obj.MetaDataID,
            "Value": db_obj.Value,
            "IsActive": db_obj.IsActive,
            "ModifiedDate": db_obj.ModifiedDate,
        }
        for db_obj in processed_metadata
    ]

    return results_as_dicts