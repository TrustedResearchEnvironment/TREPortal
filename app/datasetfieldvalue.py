from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List
import models.models as models
from sqlalchemy import func, or_ # Make sure to import 'func' and 'or_'
import models.models as models
from sqlalchemy.orm import Session
from app.VerifyHeaders import verify_headers
import database

import models.models as models
from models.models import _INT32_POS
from .dbtables import (
    DataSet,
    Field,
    DataSetFieldValue
)
router = APIRouter(
    prefix="/api/DataSetFieldValue",
    tags=["DataSetFieldValue"],
)

@router.get("/{data_set_id}", response_model=models.DataSetFieldValue)
async def get_datasetfieldvalue_by_id(
    data_set_id: _INT32_POS,  # <-- Correct way to declare a path parameter
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # --- 1. Query for the first matching record ---
    # .first() is the key change. It returns one object or None.
    result = db.query(DataSetFieldValue).filter(DataSetFieldValue.DataSetID == data_set_id).first()

    # --- 2. Handle the case where no record is found ---
    if not result:
        raise HTTPException(
            status_code=404, 
            detail=f"DataSetFieldValue with DataSetID {data_set_id} not found"
        )

    # --- 3. Return the single result, converted to the Pydantic model ---
    # No list comprehension needed since we have a single object.
    return models.DataSetFieldValue(
        DataSetFieldValueID=result.DataSetFieldValueID,
        DataSetID=result.DataSetID,
        FieldID=result.FieldID,
        Value=result.Value,
        IsActive=result.IsActive,
        ModifiedDate=result.ModifiedDate
    )

@router.post(
    "/Add",
    response_model=models.DataSetFieldValue,
    status_code=201,
    summary="Create a new Data Set Field Value link"
)
async def create_datasource_field_value(
    create_data: models.DataSetFieldValueCreate,
    db: Session = Depends(database.get_db)
):
    # Optional but recommended: Verify that the DataSourceID and FieldID actually exist
    # to prevent orphaned records.
    db_datasource = db.get(DataSet, create_data.DataSourceID)
    if not db_datasource:
        raise HTTPException(status_code=404, detail=f"DataSet with ID {create_data.DataSourceID} not found.")
    
    db_field = db.get(Field, create_data.FieldID)
    if not db_field:
        raise HTTPException(status_code=404, detail=f"Field with ID {create_data.FieldID} not found.")

    # Create the new SQLAlchemy ORM object
    new_field_value = DataSetFieldValue(
        DataSourceID=create_data.DataSourceID,
        FieldID=create_data.FieldID,
        Value=create_data.Value
    )

    try:
        db.add(new_field_value)
        db.commit()
        db.refresh(new_field_value)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create field value: {e}")
    
    response_data = models.DataSetFieldValue(
        DataSetFieldValueID=new_field_value.DataSetFieldValueID,
        DataSetID=new_field_value.DataSetID,
        FieldID=new_field_value.FieldID,
        Value=new_field_value.Value,
        IsActive=new_field_value.IsActive,
        ModifiedDate=new_field_value.ModifiedDate
    )

    # Convert the new ORM object back to a Pydantic model for the response
    return response_data
