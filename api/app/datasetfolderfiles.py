from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Query, status
from sqlalchemy import cast, Integer, func, or_, asc # Make sure to import 'func' and 'or_'
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
    prefix="/api/DataSetFolderFile",
    tags=["DataSetFolderFiles"],
)

@router.get("/{data_set_id}", response_model=List[models.DataSetFileWithFolder])
async def get_all_datasetfolders_by_id(
    data_set_id: _INT32_POS,
    db: Session = Depends(database.get_db)
):
    # 1. Fetch the data from the database
    query = db.query(
            dbtables.DataSetFolderFile,
            dbtables.DataSetFolder
        ).join(
            dbtables.DataSetFolder,
            dbtables.DataSetFolderFile.DataSetFolderID == dbtables.DataSetFolder.DataSetFolderID
        ).filter(
            dbtables.DataSetFolder.DataSetID == data_set_id
        )

    all_sqlalchemy_tuples = query.all()
    
    # 2. Manually build your new response list
    response_list = []
    for file_obj, folder_obj in all_sqlalchemy_tuples:
        response_list.append(
            models.DataSetFileWithFolder(
                # Fields from file_obj
                DataSetFolderFileID=file_obj.DataSetFolderFileID,
                DataSetFolderID=file_obj.DataSetFolderID,
                FileType=file_obj.FileType,
                FileDescription=file_obj.FileDescription,
                Redact=file_obj.Redact,
                Deidentify=file_obj.Deidentify,
                IsActive=file_obj.IsActive,
                ModifiedDate=file_obj.ModifiedDate,
                
                # Field from folder_obj
                FolderName=folder_obj.FolderName
            )
        )

    # 3. Return the new list
    return response_list
