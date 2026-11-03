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
    prefix="/api/DataSourceFolders",
    tags=["DataSourceFolders"],
)


@router.get("/SubFoldersWithFiles", response_model=List[models.DataSourceFolders])
async def get_all_datasourcesubfolderswithfiles_by_datasourceid(
    data_source_id: _INT32_POS,
    sub_folder_name: str = Query(..., max_length=500),
    db: Session = Depends(database.get_db)
):
    # 1. Fetch all active folders for the given data_source_id from the database.
    # The query is correct and includes ordering.
    query = db.query(dbtables.DataSourceFolders).filter(
        dbtables.DataSourceFolders.isActive == True,
        dbtables.DataSourceFolders.FileExtensions != None,
        dbtables.DataSourceFolders.DataSourceId == data_source_id,
        dbtables.DataSourceFolders.FolderName.ilike(f'%{sub_folder_name}%')
    ).order_by(
        asc(dbtables.DataSourceFolders.FolderName)
    )
    all_sqlalchemy_objects = query.all()

    # --- START OF NEW LOGIC ---

    # 2. Initialize an empty list to store the final, flattened results.
    flattened_results = []

    # 3. Outer Loop: Iterate through each folder object from the database.
    for db_obj in all_sqlalchemy_objects:
        folder_name = db_obj.FolderName
        
        # Guard clause: Ensure folder_name is a valid string and a UNC path.
        if not folder_name or not folder_name.startswith('\\\\'):
            continue

        parts = folder_name.lstrip(r'\\').split('\\')
 
        # Filter for folders with 3 or more parts
        if len(parts) >= 3:
            # Transform the FolderName to keep the thirds to the last part
            suffixes = parts[2:]
            new_folder_name = '\\'.join(suffixes)
            
            # --- NESTED LOGIC FOR FILE EXTENSIONS ---
            
            # 4. Split the FileExtensions string into a list of individual extensions.
            # Add a guard clause for empty/null FileExtensions string.
            extensions_string = db_obj.FileExtensions or ""
            extensions_list = [ext.strip() for ext in extensions_string.split(',') if ext.strip()]

            # 5. Inner Loop: Iterate through the list of individual extensions.
            for extension in extensions_list:
                # 6. Create a new dictionary for each extension.
                # This creates a unique object for each FolderName-FileExtension combination.
                new_folder_object = {
                    "Id": db_obj.Id,
                    "DataSourceId": db_obj.DataSourceId,
                    "FolderName": new_folder_name,
                    "FileExtensions": extension, # Use the single extension here
                    "isActive": db_obj.isActive,
                }
                
                # 7. Add the new object to our final list.
                flattened_results.append(new_folder_object)
            
    # --- END OF NEW LOGIC ---
    
    # 8. Return the final flattened list.
    return flattened_results

@router.get("/{data_source_id}", response_model=List[models.DataSourceFolders])
async def get_all_datasourcefolders_by_id(
    data_source_id: _INT32_POS,
    db: Session = Depends(database.get_db)
):
    # 1. Fetch the data from the database (same as before)
    query = db.query(dbtables.DataSourceFolders).filter(dbtables.DataSourceFolders.isActive == True).filter(
                dbtables.DataSourceFolders.DataSourceId == data_source_id
            )
    all_sqlalchemy_objects = query.all()
    
    # 2. Manually convert each SQLAlchemy object into a Pydantic object
    all_data_source_folders_as_dicts = [
        {
            "Id": db_obj.Id,
            "DataSourceId": db_obj.DataSourceId,
            "FolderName": db_obj.FolderName,
            "FileExtensions": db_obj.FileExtensions,
            "isActive": db_obj.isActive,
        }
        for db_obj in all_sqlalchemy_objects
    ]
    # 3. Return the new list of Pydantic objects
    return all_data_source_folders_as_dicts

@router.get("/FirstSubFolder/{data_source_id}", response_model=List[models.DataSourceFolders])
async def get_all_datasourcesubfolders_by_datasourceid(
    data_source_id: _INT32_POS,
    db: Session = Depends(database.get_db)
):
    # 1. Fetch all active folders for the given data_source_id from the database.
    # This part remains the same.
    query = db.query(dbtables.DataSourceFolders).filter(
        dbtables.DataSourceFolders.isActive == True,
        dbtables.DataSourceFolders.DataSourceId == data_source_id
    ).order_by(
        asc(dbtables.DataSourceFolders.FolderName) # Add this line
    )
    all_sqlalchemy_objects = query.all()

    # --- START OF NEW LOGIC ---

    # 2. Initialize an empty list to store the filtered and transformed results.
    filtered_and_transformed_folders = []

    # 3. Loop through each folder object retrieved from the database.
    for db_obj in all_sqlalchemy_objects:
        folder_name = db_obj.FolderName
        
        # Guard clause: Ensure folder_name is a valid string and a UNC path.
        if not folder_name or not folder_name.startswith('\\\\'):
            continue # Skip this item if it's not a valid UNC path

        # Remove the leading '\\' and split the path by the backslash.
        # The string r'\\' is a raw string representing a single backslash for the split.
        parts = folder_name.lstrip(r'\\').split('\\')
        
        # 4. The Condition: Check if the number of parts is exactly 3.
        if len(parts) == 3:
            # 5. Transform the FolderName: Get the last two parts and join them back.
            # Slicing with `[-2:]` gets the last two elements from the list.
            last_two_parts = parts[-2:]
            new_folder_name = '\\'.join(last_two_parts)
            
            # 6. Create a dictionary for the Pydantic model with the modified FolderName.
            # It's good practice to build a new dictionary rather than modifying the db_obj.
            transformed_folder = {
                "Id": db_obj.Id,
                "DataSourceId": db_obj.DataSourceId,
                "FolderName": new_folder_name, # Use the new, transformed name
                "FileExtensions": db_obj.FileExtensions,
                "isActive": db_obj.isActive,
            }
            
            # 7. Add the transformed object to our results list.
            filtered_and_transformed_folders.append(transformed_folder)
            
    # --- END OF NEW LOGIC ---
    
    # 8. Return the new list, which now contains only the items that matched
    #    the criteria, with their FolderNames transformed.
    return filtered_and_transformed_folders
