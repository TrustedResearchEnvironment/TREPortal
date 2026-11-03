from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List
import models.models as models
from sqlalchemy import func, or_ # Make sure to import 'func' and 'or_'
import models.models as models
from sqlalchemy.orm import Session
from app.VerifyHeaders import verify_headers
from .helper  import get_paged_result
from .audit import audit
import database

import models.models as models
from models.models import _INT32_POS
from .dbtables import (
    DataSourceType
)
router = APIRouter(
    prefix="/api/DataSourceType",
    tags=["DataSourceType"],
)

@router.get("", response_model=models.DataSourceTypePagedResult)
async def get_all_datasourcetypes(
    page: int = 1,
    pageSize: int = 5,
    search: str = Query(None),
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # --- 1. Build the base query and apply filters ---
    query = db.query(DataSourceType)
    
    # --- 2. Apply search filter if provided ---
    if search:
        lower_search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(DataSourceType.Name).like(lower_search_term),
                func.lower(DataSourceType.Description).like(lower_search_term)
            )
        ) 
    
    results = [
        models.DataSourceType(
            # Fields from the DataSet class
            DataSourceTypeID=dst.DataSourceTypeID,
            Name=dst.Name,
            Description=dst.Description,
            IsActive=dst.IsActive,
            ModifiedDate=dst.ModifiedDate
        )
        for dst in query.all()
    ]

    return get_paged_result(results, page, pageSize)


@router.post("/Create", response_model=models.DataSourceType)
async def create_datasourcetype(
    datasourcetype: models.DataSourceType,
    upn: str = None,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # Create new DataSourceType instance
    new_datasourcetype = DataSourceType(
        Name=datasourcetype.Name,
        Description=datasourcetype.Description,
        IsActive=datasourcetype.IsActive,
        ModifiedDate=func.now()  # Set current timestamp
    )
    
    try:
        # Add and commit to database
        db.add(new_datasourcetype)
        db.commit()
        db.refresh(new_datasourcetype)
        
        # Convert to response model
        result = models.DataSourceType(
            DataSourceTypeID=new_datasourcetype.DataSourceTypeID,
            Name=new_datasourcetype.Name,
            Description=new_datasourcetype.Description,
            IsActive=new_datasourcetype.IsActive,
            ModifiedDate=new_datasourcetype.ModifiedDate
        )
        audit(
            event="datasourcetype.create", action="create", result="success",
            upn=auth_info["upn"], method="POST", path="/api/DataSourceType/Create",
            item_type="DataSourceType", item_id=new_datasourcetype.DataSourceTypeID,
            status_code=200,
        )
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error creating data source type: {str(e)}"
        )


@router.put("/Update/{id}", response_model=models.DataSourceType)
async def update_datasourcetype(
    id: _INT32_POS,
    datasourcetype: models.DataSourceType,
    upn: str = None,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # Find existing data source type
    existing_datasourcetype = db.query(DataSourceType).filter(DataSourceType.DataSourceTypeID == id).first()
    if not existing_datasourcetype:
        raise HTTPException(
            status_code=404,
            detail=f"Data source type with ID {id} not found"
        )

    try:
        # Update fields
        existing_datasourcetype.Name = datasourcetype.Name
        existing_datasourcetype.Description = datasourcetype.Description
        existing_datasourcetype.IsActive = datasourcetype.IsActive
        existing_datasourcetype.ModifiedDate = func.now()

        # Commit changes
        db.commit()
        db.refresh(existing_datasourcetype)

        # Return updated record
        result = models.DataSourceType(
            DataSourceTypeID=existing_datasourcetype.DataSourceTypeID,
            Name=existing_datasourcetype.Name,
            Description=existing_datasourcetype.Description,
            IsActive=existing_datasourcetype.IsActive,
            ModifiedDate=existing_datasourcetype.ModifiedDate
        )
        audit(
            event="datasourcetype.update", action="update", result="success",
            upn=auth_info["upn"], method="PUT", path=f"/api/DataSourceType/Update/{id}",
            item_type="DataSourceType", item_id=id,
            status_code=200,
        )
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error updating data source type: {str(e)}"
        )
    
# @router.get("/GetDataSourceTypeList", response_model=List[models.DataSourceType])
# async def get_datasourcetype_list():
#     return [
#         {
#             "dataSourceTypeId": 1,
#             "name": "SQL Server",
#             "description": "Microsoft SQL Server",
#             "modifiedDate": "2025-08-19T12:00:00Z",
#         }
#     ]

# @router.get("/TypeAhead", response_model=List[models.DataSourceType])
# async def type_ahead(name: str = None):
#     return [
#         {
#             "dataSourceTypeId": 1,
#             "name": "SQL Server",
#             "description": "Microsoft SQL Server",
#             "modifiedDate": "2025-08-19T12:00:00Z",
#         }
#     ]

# @router.get("/{id}", response_model=models.DataSourceType)
# async def get_datasourcetype_by_id(id: int):
#     return {
#         "dataSourceTypeId": id,
#         "name": "SQL Server",
#         "description": "Microsoft SQL Server",
#         "modifiedDate": "2025-08-19T12:00:00Z",
#     }

# @router.post("", response_model=models.DataSourceType)
# async def create_datasourcetype(datasourcetype: models.DataSourceType):
#     return datasourcetype

# @router.put("/{id}")
# async def update_datasourcetype(id: int, datasourcetype: models.DataSourceType):
#     return {"message": "DataSourceType updated successfully"}

# @router.delete("/{id}")
# async def delete_datasourcetype(id: int):
#     return {"message": "DataSourceType deleted successfully"}
