from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import List
import models.models as models
from app.VerifyHeaders import verify_headers
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_ 

from .helper  import get_paged_result
from .audit import audit

import database

import models.models as models
from models.models import _INT32_POS
from .dbtables import (
    MetaData,
    DataSourceTypeMetaData,
    DataSet, 
    DataSetMetaDataValue, 
    DataSource
)

router = APIRouter(
    prefix="/api/MetaData",
    tags=["MetaData"],
)

@router.get("", response_model=models.MetaDataPagedResult)
async def get_all_metadata(
    page: int = 1,
    pageSize: int = 5,
    search: str = Query(None),
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # --- 1. Build the base query and apply filters ---
    query = db.query(MetaData).filter(MetaData.IsActive.in_([0, 1]))
    
    # --- 2. Apply search filter if provided ---
    if search:
        lower_search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(MetaData.Name).like(lower_search_term),
                func.lower(MetaData.Description).like(lower_search_term)
            )
        ) 
    
    # --- 2. Execute the primary query once ---
    metadata_rows = query.all()
    metadata_ids = [m.MetaDataID for m in metadata_rows]

    # --- 3. FETCH ALL LINKS IN ONE GO (The Fix) ---
    # This replaces the query that was inside your loop
    link_map = {}
    if metadata_ids:
        links = (
            db.query(DataSourceTypeMetaData.MetaDataID, DataSourceTypeMetaData.DataSourceTypeID)
            .filter(DataSourceTypeMetaData.MetaDataID.in_(metadata_ids))
            .all()
        )
        # Group the IDs into a dictionary: {1: [10, 11], 2: [15]}
        from collections import defaultdict
        link_map = defaultdict(list)
        for m_id, ds_id in links:
            link_map[m_id].append(ds_id)

    # --- 4. Build results using the map (No more SQL queries here!) ---
    results = []
    for md in metadata_rows:
        # Instead of querying the DB, we just look at our Python dictionary
        ds_type_ids = link_map.get(md.MetaDataID, [])
        
        results.append(
            models.MetaData(
                MetaDataID=md.MetaDataID,
                Name=md.Name,
                Description=md.Description,
                IsActive=md.IsActive,
                ModifiedDate=md.ModifiedDate,
                DataSourceTypeIDs=ds_type_ids
            )
        )

    return get_paged_result(results, page, pageSize)

@router.put(
    "/Update/{meta_data_id}", 
    response_model=models.MetaData,
    summary="Fully update a Meta Data and its fields"
)
async def fully_update_meta_data(
    meta_data_id: _INT32_POS,
    update_data: models.MetaDataCreate,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    upn = auth_info["upn"]
    try:
        # --- STEP 1: Fetch the existing record ---
        db_metadata = db.query(MetaData).filter(MetaData.MetaDataID == meta_data_id).first()

        # --- STEP 2: Check if it exists ---
        if db_metadata is None:
            raise HTTPException(status_code=404, detail=f"Meta Data with ID {meta_data_id} not found")

        # --- STEP 3: Update the attributes of the SQLAlchemy object in memory ---
        db_metadata.Name = update_data.Name
        db_metadata.Description = update_data.Description
        db_metadata.IsActive = update_data.IsActive
        db_metadata.ModifiedDate = datetime.now(timezone.utc)
        
        # --- STEP 4: Update DataSourceTypeMetaData links if provided ---
        if hasattr(update_data, "DataSourceTypeIDs") and update_data.DataSourceTypeIDs is not None:
            # Delete existing links
            db.query(DataSourceTypeMetaData).filter(DataSourceTypeMetaData.MetaDataID == meta_data_id).delete(synchronize_session=False)
            # Insert new links from provided pairs [[id, name], ...]
            for ds_type_id in update_data.DataSourceTypeIDs:
                link = DataSourceTypeMetaData(DataSourceTypeID=ds_type_id, MetaDataID=meta_data_id)
                db.add(link)

        # --- STEP 5: Commit the changes ---
        db.commit()

        # --- STEP 6: Refresh the instance to get any DB-level changes (like triggers) ---
        db.refresh(db_metadata)
        
        audit(
            event="metadata.update", action="update", result="success",
            upn=upn, method="PUT", path=f"/api/MetaData/Update/{meta_data_id}",
            item_type="MetaData", item_id=meta_data_id,
            status_code=200,
        )
        # --- STEP 7: Return the updated SQLAlchemy object ---
        # FastAPI will automatically serialize it using your response_model.
        return db_metadata

    except HTTPException as http_exc:
        db.rollback()
        # Preserve HTTPException responses (e.g., 404) instead of converting them to 500
        raise http_exc
    except Exception as e:
        db.rollback()
        # Log the error for debugging
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
 
@router.post(
    "/Add",
    response_model=models.MetaData,
    # status_code=status.HTTP_201_CREATED,
    summary="Create a new Meta Data with its fields"
)
async def create_metadata(
    create_metadata: models.MetaDataCreate,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    upn = auth_info["upn"]
    try:
        # --- 1. Create the main DataSource object ---
        new_datasource = MetaData(
            Name=create_metadata.Name,
            Description=create_metadata.Description,
            IsActive=create_metadata.IsActive,
            ModifiedDate=datetime.now(timezone.utc)
        )
        
  
        # --- 2. Save to database ---
        db.add(new_datasource)
        db.commit()
        db.refresh(new_datasource)

        # --- 3. Insert DataSourceTypeMetaData links if provided ---
        meta_id = new_datasource.MetaDataID
        if hasattr(create_metadata, "DataSourceTypeIDs") and create_metadata.DataSourceTypeIDs:
            for ds_type_id in create_metadata.DataSourceTypeIDs:
                link = DataSourceTypeMetaData(DataSourceTypeID=ds_type_id, MetaDataID=meta_id)
                db.add(link)
            db.commit()
            db.refresh(new_datasource)

        # --- 4. Build the response ---
        response_model = models.MetaData(
            MetaDataID=new_datasource.MetaDataID,
            Name=new_datasource.Name,
            Description=new_datasource.Description,
            ModifiedDate=new_datasource.ModifiedDate,
            IsActive=new_datasource.IsActive,
            DataSourceTypeIDs=create_metadata.DataSourceTypeIDs if hasattr(create_metadata, "DataSourceTypeIDs") else []
        )
        
        audit(
            event="metadata.create", action="create", result="success",
            upn=upn, method="POST", path="/api/MetaData/Add",
            item_type="MetaData", item_id=response_model.MetaDataID,
            status_code=200,
        )
        return response_model
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )
    
@router.put(
    "/Cancel/{meta_data_id}",
    summary="Cancel a MetaData if not linked to DataSets or DataSource Types"
)
async def cancel_metadata(
    meta_data_id: _INT32_POS,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    """
    Marks a MetaData row as cancelled by setting IsActive to 2 instead of deleting.
    IsActive=2 indicates the MetaData has been cancelled/deleted.
    Only marks as cancelled if it is not referenced by DataSetMetaDataValue or DataSourceTypeMetaData.
    Returns context-specific error messages if references exist.
    """
    try:
        # ensure the MetaData exists
        db_metadata = db.query(MetaData).filter(MetaData.MetaDataID == meta_data_id).first()
        if db_metadata is None:
            raise HTTPException(status_code=404, detail=f"Meta Data with ID {meta_data_id} not found")

        # check associations
        exists_in_dataset = (
            db.query(DataSetMetaDataValue)
            .filter(DataSetMetaDataValue.MetaDataID == meta_data_id)
            .first() is not None
        )
        exists_in_dstype = (
            db.query(DataSourceTypeMetaData)
            .filter(DataSourceTypeMetaData.MetaDataID == meta_data_id)
            .first() is not None
        )

        if exists_in_dataset and exists_in_dstype:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected MetaData is associated with a DataSet and DataSource Type. It cannot be deleted."
            )

        if exists_in_dataset:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MetaData is associated with an existing DataSet. It cannot be deleted"
            )

        if exists_in_dstype:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected MetaData is associated with a DataSource Type. It cannot be deleted."
            )

        # Soft delete: Set IsActive to 2 (cancelled) instead of deleting the record
        # IsActive=2 indicates the MetaData has been cancelled/deleted
        from datetime import datetime
        db_metadata.IsActive = 2
        db_metadata.ModifiedDate = datetime.now()
        db.commit()
        audit(
            event="metadata.cancel", action="cancel", result="success",
            upn=auth_info["upn"], method="PUT", path=f"/api/MetaData/Cancel/{meta_data_id}",
            item_type="MetaData", item_id=meta_data_id,
            status_code=200,
        )
        return {"message": "Successfully cancelled"}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"An error occurred while deleting MetaData {meta_data_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
   
# @router.get("/GetMetaDataList", response_model=List[models.MetaData])
# async def get_metadata_list():
#     return [
#         {
#             "metaDataID": 1,
#             "name": "Sample MetaData",
#             "description": "Sample metadata.",
#             "modifiedDate": "2025-08-19T12:00:00Z",
#         }
#     ]

# @router.get("/TypeAhead", response_model=List[models.MetaData])
# async def type_ahead(name: str = None):
#     return [
#         {
#             "metaDataID": 1,
#             "name": "Sample MetaData",
#             "description": "Sample metadata.",
#             "modifiedDate": "2025-08-19T12:00:00Z",
#         }
#     ]

# @router.get("/{id}", response_model=models.MetaData)
# async def get_metadata_by_id(id: int):
#     return {
#         "metaDataID": id,
#         "name": "Sample MetaData",
#         "description": "Sample metadata.",
#         "modifiedDate": "2025-08-19T12:00:00Z",
#     }

# @router.post("", response_model=models.MetaData)
# async def create_metadata(metadata: models.MetaData):
#     return metadata

# @router.put("/{id}")
# async def update_metadata(id: int, metadata: models.MetaData):
#     return {"message": "MetaData updated successfully"}

# @router.delete("/{id}")
# async def delete_metadata(id: int):
#     return {"message": "MetaData deleted successfully"}


@router.get("/orphaned-values", summary="List MetaData values no longer linked to DataSource types")
async def get_orphaned_metadata_values(auth_info: dict = Depends(verify_headers), db: Session = Depends(database.get_db)):
    """
    Return DataSetMetaDataValue rows whose MetaDataID is not linked
    to the DataSourceType of the DataSet's DataSource.
    """
    try:
        orphaned = (
            db.query(DataSetMetaDataValue)
            .join(DataSet, DataSet.DataSetID == DataSetMetaDataValue.DataSetID)
            .join(DataSource, DataSource.DataSourceID == DataSet.DataSourceID)
            .outerjoin(
                DataSourceTypeMetaData,
                and_(
                    DataSourceTypeMetaData.MetaDataID == DataSetMetaDataValue.MetaDataID,
                    DataSourceTypeMetaData.DataSourceTypeID == DataSource.DataSourceTypeID,
                ),
            )
            .filter(DataSourceTypeMetaData.MetaDataID.is_(None))
            .all()
        )

        results = [
            {
                "DataSetMetaDataValueID": o.DataSetMetaDataValueID,
                "DataSetID": o.DataSetID,
                "MetaDataID": o.MetaDataID,
                "Value": o.Value,
            }
            for o in orphaned
        ]

        return {"orphaned_dataset_metadata_values": results}

    except Exception as e:
        print(f"Error fetching orphaned metadata values: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch orphaned metadata values")