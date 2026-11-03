from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List
import models.models as models
from sqlalchemy import func, or_ # Make sure to import 'func' and 'or_'
import models.models as models
from sqlalchemy.orm import Session
from app.VerifyHeaders import verify_headers
import database

import models.models as models
from .dbtables import (
    DataSource,
    Field,
    DataSourceFieldValue
)
router = APIRouter(
    prefix="/api/DataSourceFieldValue",
    tags=["DataSourceFieldValue"],
)

@router.get("", response_model=List[models.DataSourceFieldValue])
async def get_datasourcefields(
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # --- 1. Build the base query and apply filters ---
    results_list = db.query(DataSourceFieldValue).all()

    return [
        models.DataSourceFieldValue(
            # Fields from the DataSourceFieldValue class
            DataSourceFieldValueID=result.DataSourceFieldValueID,
            DataSourceID=result.DataSourceID,
            FieldID=result.FieldID,
            Value=result.Value
        ) for result in results_list
    ]

@router.post(
    "/Add",
    response_model=models.DataSourceFieldValue,
    status_code=201,
    summary="Create a new Data Source Field Value link"
)
async def create_datasource_field_value(
    create_data: models.DataSourceFieldValueCreate,
    db: Session = Depends(database.get_db)
):
    # Optional but recommended: Verify that the DataSourceID and FieldID actually exist
    # to prevent orphaned records.
    db_datasource = db.get(DataSource, create_data.DataSourceID)
    if not db_datasource:
        raise HTTPException(status_code=404, detail=f"DataSource with ID {create_data.DataSourceID} not found.")
    
    db_field = db.get(Field, create_data.FieldID)
    if not db_field:
        raise HTTPException(status_code=404, detail=f"Field with ID {create_data.FieldID} not found.")

    # Create the new SQLAlchemy ORM object
    new_field_value = DataSourceFieldValue(
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
    
    response_data = models.DataSourceFieldValue(
        DataSourceFieldValueID=new_field_value.DataSourceFieldValueID,
        DataSourceID=new_field_value.DataSourceID,
        FieldID=new_field_value.FieldID,
        Value=new_field_value.Value
    )

    # Convert the new ORM object back to a Pydantic model for the response
    return response_data
