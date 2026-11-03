from fastapi import APIRouter, Depends, Query
from typing import List
import models.models as models
from app.VerifyHeaders import verify_headers
from sqlalchemy.orm import Session
import database

from .dbtables import (
    Field
)

router = APIRouter(
    prefix="/api/Field",
    tags=["Field"],
)

@router.get("", response_model=List[models.Field])
async def get_fields(
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # --- 1. Build the base query and apply filters ---
    result_list = db.query(Field).all()
    
    return [
        models.Field(
            # Fields from the DataSourceFieldValue class
            FieldID=result.FieldID,
            Name=result.Name,
            Description=result.Description,
            IsActive=result.IsActive,
            ModifiedDate=result.ModifiedDate,
            isLocked=result.isLocked
        ) for result in result_list 
    ]

# @router.get("/GetFieldList", response_model=List[models.FieldModel])
# async def get_field_list():
#     return [
#         {
#             "fieldID": 1,
#             "name": "Sample Field",
#             "description": "A sample field.",
#             "modifiedDate": "2025-08-19T12:00:00Z",
#         }
#     ]

# @router.get("/TypeAhead", response_model=List[models.FieldModel])
# async def type_ahead(name: str = None):
#     return [
#         {
#             "fieldID": 1,
#             "name": "Sample Field",
#             "description": "A sample field.",
#             "modifiedDate": "2025-08-19T12:00:00Z",
#         }
#     ]

# # @router.get("/{id}", response_model=models.FieldModel)
# # async def get_field_by_id(id: int):
# #     return {
# #         "fieldID": id,
# #         "name": "Sample Field",
# #         "description": "A sample field.",
# #         "modifiedDate": "2025-08-19T12:00:00Z",
# #     }

# # @router.post("", response_model=models.FieldModel)
# # async def create_field(field: models.FieldModel):
# #     return field

# # @router.put("/{id}")
# # async def update_field(id: int, field: models.FieldModel):
# #     return {"message": "Field updated successfully"}

# # @router.delete("/{id}")
# # async def delete_field(id: int):
# #     return {"message": "Field deleted successfully"}
