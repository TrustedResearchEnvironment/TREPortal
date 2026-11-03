from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Query, status
from sqlalchemy import cast, Integer, func, or_ # Make sure to import 'func' and 'or_'
from sqlalchemy import text # REMOVE AFTER
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

router = APIRouter(
    prefix="/api/DataSourceTables",
    tags=["DataSourceTables"],
)

@router.get("/DataSourceID/{data_source_id}", response_model=List[models.DataSourceTables])
async def get_all_datasourcetables_by_datasrcid(
    data_source_id: _INT32_POS,
    db: Session = Depends(database.get_db)
):
    # 1. Fetch the data from the database (same as before)
    query = db.query(dbtables.DataSourceTables).filter(
            dbtables.DataSourceTables.isActive == True
            ).filter(
                dbtables.DataSourceTables.DataSourceId == data_source_id
            )
    all_sqlalchemy_objects = query.all()
    
    # 2. Manually convert each SQLAlchemy object into a Pydantic object
    all_data_source_tables_as_dicts = [
        {
            "Id": db_obj.Id,
            "DataSourceId": db_obj.DataSourceId,
            "TableName": db_obj.TableName,
            "ColumnList": db_obj.ColumnList,
            "ColumnTypes": db_obj.ColumnTypes,
            "isActive": db_obj.isActive,
        }
        for db_obj in all_sqlalchemy_objects
    ]
    # 3. Return the new list of Pydantic objects
    return all_data_source_tables_as_dicts


@router.get("/TableID/{table_id}", response_model=models.DataSourceTables)
async def get_datasourcetable_by_id(
    table_id: _INT32_POS,
    db: Session = Depends(database.get_db)
):
    # --- 1: Use .first() to get one object or None ---
    db_obj = db.query(dbtables.DataSourceTables).filter(
        dbtables.DataSourceTables.isActive == True,
        dbtables.DataSourceTables.Id == table_id
    ).first() # .first() is the key change here
    
    # --- 2: Add error handling for the "not found" case ---
    if not db_obj:
        raise HTTPException(
            status_code=404, 
            detail=f"Table with id {table_id} not found"
        )

    # --- 3: Manually convert and return a SINGLE object ---
    # No list comprehension is needed.
    return {
        "Id": db_obj.Id,
        "DataSourceId": db_obj.DataSourceId,
        "TableName": db_obj.TableName,
        "ColumnList": db_obj.ColumnList,
        "ColumnTypes": db_obj.ColumnTypes,
        "isActive": db_obj.isActive,
    }
