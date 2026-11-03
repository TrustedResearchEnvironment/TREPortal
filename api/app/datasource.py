from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Query, status
from sqlalchemy import cast, Integer, func, or_ # Make sure to import 'func' and 'or_'
from sqlalchemy import text # REMOVE AFTER
from typing import List, Optional
from fastapi import Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from app.VerifyHeaders import verify_headers
from .audit import audit
from . import dbtables, config 
import models.models as models
from models.models import _INT32_POS
import database
from .helper  import get_paged_result

router = APIRouter(
    prefix="/api/DataSource",
    tags=["DataSource"],
)

DB_DATASOURCE_TYPE_ID = 1
REDCAP_DATASOURCE_TYPE_ID = 2
FOLDER_DATASOURCE_TYPE_ID = 3

@router.get("", response_model=models.DataSourcePagedResult)
async def get_all_datasources(
    page: int = 1,
    pageSize: int = 5,
    search: str = Query(None), # <-- 1. Accept the search parameter
    activeStatus: int = 3, 
    name: Optional[str] = None, 
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    
    """
        This endpoint retrieves a paginated list of Data Sources, 
        with optional filtering by search term and active status.
    """

    # --- 2. Build the base query ---
    # query = db.query(dbtables.DataSource)

    # Query for the parent DataSource object
    query = db.query(dbtables.DataSource)

    # Validate and map activeStatus (0 = inactive, 1 = active, 2 cancelled,3 = all)
    if activeStatus not in (0, 1, 2, 3):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid activeStatus. Allowed values are 0 (inactive), 1 (active), 2 (cancelled), or 3 (all).",
        )

    if activeStatus == 1:
        query = query.filter(dbtables.DataSource.IsActive == 1)
    elif activeStatus == 0:
        query = query.filter(dbtables.DataSource.IsActive == 0)
    elif activeStatus == 2:
        query = query.filter(dbtables.DataSource.IsActive == 2)
    else:
        # activeStatus == 3 (all): exclude cancelled (IsActive=2)
        query = query.filter(dbtables.DataSource.IsActive != 2)

    # Eagerly load the related field_values and their corresponding field in one query
    query = query.options(
        joinedload(dbtables.DataSource.field_values)
        .joinedload(dbtables.DataSourceFieldValue.field)
    )

    # --- 3. Apply search filter if provided ---
    if search:
        # We lower the search term ONCE in Python
        lower_search_term = f"%{search.lower()}%"
        
        query = query.filter(
            # We then compare it to the lowercased value of the database columns
            # This generates SQL like: WHERE LOWER(Name) LIKE @param OR LOWER(Description) LIKE @param
            or_(
                func.lower(dbtables.DataSource.Name).like(lower_search_term),
                func.lower(dbtables.DataSource.Description).like(lower_search_term)
            )
        )

    all_data_sources = query.all()
    
    # Process the ORM objects into Pydantic models
    results = []
    for ds in all_data_sources:
        # The related data is pre-loaded, so this loop is fast
        fields_dict = {
            fv.field.Name: fv.Value
            for fv in ds.field_values
        }
        
        # Create the Pydantic model
        results.append(
            models.DataSourceWithFieldDict(
                # Base DataSource fields
                DataSourceTypeID=ds.DataSourceTypeID,
                DataSourceID=ds.DataSourceID,
                Name=ds.Name,
                Description=ds.Description,
                isRefreshed=ds.isRefreshed,
                ModifiedDate=ds.ModifiedDate,
                IsActive=ds.IsActive,
                RefreshedDate=ds.RefreshedDate,
                
                # The nested dictionary of fields
                Fields=fields_dict
            )
        )
    print(results)
    return get_paged_result(results, page, pageSize)



# Miguel
# This should be used in the DataSet dashboard to get the tables associated with each connection
@router.get(
    "/DataSourceTable",
    # The response is a LIST of DatabaseConnection objects with Tables
    response_model=List[models.DataSourceTable],
    summary="Get all DataSourceTables associated with Database Connections"
)
async def get_database_connection(
    db: Session = Depends(database.get_db)
):
    # results = db.query(dbtables.LoomeIntegrateConnections).all()

    results = (
        db.query(
            dbtables.LoomeIntegrateConnections,
            dbtables.LoomeDataSourceTables,
            dbtables.DataSourceFieldValue
        )
        .filter(dbtables.LoomeIntegrateConnections.ConnectionType == 'Microsoft SQL Server')
        .join(
            dbtables.DataSourceFieldValue,
            dbtables.LoomeDataSourceTables.DataSourceId == dbtables.DataSourceFieldValue.DataSourceID
        )
        # Skips the Value that can't be converted to numeric
        .filter(func.isnumeric(dbtables.DataSourceFieldValue.Value) == 1)
        # Join the result with LoomeIntegrateConnections, casting the Value to an Integer
        .join(
            dbtables.LoomeIntegrateConnections,
            cast(dbtables.DataSourceFieldValue.Value, Integer) == dbtables.LoomeIntegrateConnections.ConnectionID
        )
        .all()
    )
    
    # Use a dictionary to group tables by their unique connection ID
    connections: Dict[int, models.DataSourceTable] = {}
    for lic, ldst, dsfv in results:
        # If we haven't seen this connection before, create its main entry
        # CORRECTED: Changed 'ConnectionId' to 'ConnectionID' for consistency.
        if lic.ConnectionID not in connections:
            connections[lic.ConnectionID] = models.DataSourceTable(
                # Swapped dsfv and lic to get attributes from the correct objects
                ConnectionId=lic.ConnectionID,
                ConnectionName=lic.ConnectionName,
                Tables=[]  # Initialize with an empty list for table info
            )

        # Append the table info from the current row to the correct connection
        connections[lic.ConnectionID].Tables.append(
            models.TableInfo(
                TableName=ldst.TableName,
                ColumnList=ldst.ColumnList,
                ColumnTypes=ldst.ColumnTypes
            )
        )

    # Convert the dictionary of grouped connections into a list for the response
    return list(connections.values())



@router.get(
    "/DataSourceFolder",
    # The response is a LIST of Folder Connection objects with folder paths and extensions
    response_model=List[models.LoomeDataSourceFolders],
    summary="Get all DataSourceFolders associated with Folder Connections"
)
async def get_database_connection(
    db: Session = Depends(database.get_db)
):
    results = (
        db.query(
            dbtables.LoomeIntegrateConnections,
            dbtables.LoomeDataSourceFolders,
            dbtables.DataSourceFieldValue
        )
        .filter(dbtables.LoomeIntegrateConnections.ConnectionType == 'Azure Data Lake Storage Gen2')
        .join(
            dbtables.DataSourceFieldValue,
            dbtables.LoomeDataSourceFolders.DataSourceId == dbtables.DataSourceFieldValue.DataSourceID
        )
        # Skips the Value that can't be converted to numeric
        .filter(func.isnumeric(dbtables.DataSourceFieldValue.Value) == 1)
        # Join the result with LoomeIntegrateConnections, casting the Value to an Integer
        .join(
            dbtables.LoomeIntegrateConnections,
            cast(dbtables.DataSourceFieldValue.Value, Integer) == dbtables.LoomeIntegrateConnections.ConnectionID
        )
        .all()
    )
    
    # Use a dictionary to group tables by their unique connection ID
    connections: Dict[int, models.LoomeDataSourceFolders] = {}
    for lic, ldst, dsfv in results:
        # If we haven't seen this connection before, create its main entry
        # CORRECTED: Changed 'ConnectionId' to 'ConnectionID' for consistency.
        if lic.ConnectionID not in connections:
            connections[lic.ConnectionID] = models.LoomeDataSourceFolders(
                # Swapped dsfv and lic to get attributes from the correct objects
                ConnectionId=lic.ConnectionID,
                ConnectionName=lic.ConnectionName,
                Folders=[]  # Initialize with an empty list for folder info
            )

        # Append the folder info from the current row to the correct connection
        connections[lic.ConnectionID].Folders.append(
            models.FolderInfo(
                FolderName=ldst.FolderName,
                FileExtensions=ldst.FileExtensions,
            )
        )

    # Convert the dictionary of grouped connections into a list for the response
    return list(connections.values())






# ------------------
# # Revised: Using ConnectionType
# @router.get(
#     "/DataSourceTable",
#     response_model=List[models.DataSourceTable],
#     summary="Get all DataSourceTables associated with Microsoft SQL Server"
# )
# async def get_database_connection(
#     db: Session = Depends(database.get_db)
# ):
#     results = (
#         db.query(
#             dbtables.LoomeIntegrateConnections,
#             dbtables.LoomeDataSourceTables,
#             dbtables.DataSourceFieldValue
#         )
#         # 1. Start with LoomeIntegrateConnections and filter it first.
#         .filter(dbtables.LoomeIntegrateConnections.ConnectionType == "Microsoft SQL Server")
        
#         # 2. Join with DataSourceFieldValue, casting the 'Value' to an Integer.
#         .join(
#             dbtables.DataSourceFieldValue,
#             dbtables.LoomeIntegrateConnections.ConnectionID == cast(dbtables.DataSourceFieldValue.Value, Integer)
#         )
        
#         # 3. Join through the DataSource table.
#         .join(
#             dbtables.DataSource,
#             dbtables.DataSourceFieldValue.DataSourceID == dbtables.DataSource.DataSourceID
#         )
        
#         # 4. Finally, join with LoomeDataSourceTables.
#         .join(
#             dbtables.LoomeDataSourceTables,
#             dbtables.DataSource.DataSourceID == dbtables.LoomeDataSourceTables.DataSourceId
#         )
#         .all()
#     )
    
#     # Use a dictionary to group tables by their unique connection ID
#     connections: Dict[int, models.DataSourceTable] = {}
#     for lic, ldst, dsfv in results:
#         # If we haven't seen this connection before, create its main entry
#         if lic.ConnectionID not in connections:
#             connections[lic.ConnectionID] = models.DataSourceTable(
#                 DataSourceID=dsfv.DataSourceID,
#                 FieldID=dsfv.FieldID,
#                 Value=dsfv.Value,
#                 ConnectionId=lic.ConnectionID,
#                 ConnectionName=lic.ConnectionName,
#                 Tables=[]  # Initialize with an empty list for table info
#             )

#         # Append the table info from the current row to the correct connection
#         connections[lic.ConnectionID].Tables.append(
#             models.TableInfo(
#                 TableName=ldst.TableName,
#                 ColumnList=ldst.ColumnList,
#                 ColumnTypes=ldst.ColumnTypes
#             )
#         )

#     # Convert the dictionary of grouped connections into a list for the response
#     return list(connections.values())


@router.get(
    "/DatabaseConnection",
    # The response is a LIST of DatabaseConnection objects
    response_model=List[models.DatabaseConnection],
    summary="Get all Database Connections by filtering ConnectionType='Microsoft SQL Server'"
)
async def get_database_connection(
    db: Session = Depends(database.get_db)
):
    results = db.query(dbtables.LoomeIntegrateConnections).filter(dbtables.LoomeIntegrateConnections.ConnectionType == "Microsoft SQL Server")
    return results




# @router.get(
#     "/Folder",
#     # The response is a LIST of LoomeDataSourceFolders objects
#     response_model=List[models.LoomeDataSourceFolders],
#     summary="Get all DataSource Folders"
# )
# async def get_datasource_folder(
#     db: Session = Depends(database.get_db)
# ):
#     """
#     Retrieves a list of all folders associated with Data Sources of type 'Folder' (ID 3),
#     and groups them by their DataSourceId.
#     """
#     # 1. Query both the LoomeDataSourceFolders and DataSource tables directly.
#     # This returns a list of tuples, e.g., [(folder_obj_1, ds_obj_1), (folder_obj_2, ds_obj_2)].
#     results = (
#         db.query(dbtables.LoomeDataSourceFolders, dbtables.DataSource)
#         .join(
#             dbtables.DataSource,
#             dbtables.LoomeDataSourceFolders.DataSourceId == dbtables.DataSource.DataSourceID
#         )
#         .filter(dbtables.DataSource.DataSourceTypeID == 3)
#         .order_by(dbtables.LoomeDataSourceFolders.DataSourceId)
#         .all()
#     )

#     grouped_folders: Dict[int, models.LoomeDataSourceFolders] = {}
    
#     # 2. Unpack the tuple into two variables in the loop.
#     for folder_item, ds_item in results:
#         if folder_item.DataSourceId not in grouped_folders:
#             grouped_folders[folder_item.DataSourceId] = models.LoomeDataSourceFolders(
#                 # 3. Get the 'Name' from the DataSource object ('ds_item').
#                 Name=ds_item.Name,
#                 DataSourceId=folder_item.DataSourceId,
#                 Folders=[]
#             )

#         grouped_folders[folder_item.DataSourceId].Folders.append(
#             models.FolderDetail(
#                 FolderName=folder_item.FolderName,
#                 FileExtensions=folder_item.FileExtensions
#             )
#         )

#     return list(grouped_folders.values())

# ---------------- Revised -------------
@router.get(
    "/Folder",
    # The response is a LIST of LoomeDataSourceFolders objects
    # response_model=List[models.LoomeDataSourceFolders],
    # TEST only if the model works
    response_model=List[models.DatabaseConnection],
    summary="Get all Database Connections by filtering ConnectionType='Azure Data Lake Storage Gen2' or 'CSV 2018'"
)
async def get_datasource_folder(
    db: Session = Depends(database.get_db)
):
    target_types = ["Azure Data Lake Storage Gen2", "CSV 2018"]
    results = db.query(dbtables.LoomeIntegrateConnections)\
        .filter(dbtables.LoomeIntegrateConnections.ConnectionType.in_(target_types))\
        .all()
    
    return results





# ----------------------------------------------------------------

@router.get(
    "/{data_source_id}", 
    # Use a simple List of your detailed model. No pagination needed.
    response_model=List[models.DataSourceWithFieldDict],
    summary="Get ALL records matching a DataSourceID"
)
async def get_datasource_by_id(
    data_source_id: _INT32_POS,
    db: Session = Depends(database.get_db)
):
    """
    It fetches ALL rows that match a given DataSourceID, bypassing pagination.
    """
    print(f"--- DEBUG: Fetching all records for DataSourceID: {data_source_id} ---")
    
    # --- 1. Build the query ---
    # We use .all() instead of .first() to get every matching record.
    duplicate_check_query = (
        db.query(dbtables.DataSource)
        .options(
            joinedload(dbtables.DataSource.field_values)
            .joinedload(dbtables.DataSourceFieldValue.field)
        )
        .filter(dbtables.DataSource.DataSourceID == data_source_id)
    )
    
    # --- 2. Execute the query ---
    all_matching_records = duplicate_check_query.all()

    # --- 3. Log the findings ---
    record_count = len(all_matching_records)
    print(f"--- DEBUG: Found {record_count} record(s) for DataSourceID: {data_source_id} ---")

    if record_count == 0:
        raise HTTPException(status_code=404, detail=f"No DataSource found with ID {data_source_id}")

    # --- 4. Process the results into Pydantic models ---
    # This is the same processing logic as your main endpoint.
    results = []
    for ds in all_matching_records:
        fields_dict = {
            fv.field.Name: fv.Value
            for fv in ds.field_values
        }
        
        results.append(
            models.DataSourceWithFieldDict(
                DataSourceTypeID=ds.DataSourceTypeID,
                DataSourceID=ds.DataSourceID,
                Name=ds.Name,
                Description=ds.Description,
                isRefreshed=ds.isRefreshed,
                ModifiedDate=ds.ModifiedDate,
                IsActive=ds.IsActive,
                RefreshedDate=ds.RefreshedDate,
                Fields=fields_dict
            )
        )
        
    return results

@router.put(
    "/Update/{data_source_id}", 
    response_model=models.DataSourceWithFieldDict,
    summary="Fully update a Data Source and its fields"
)
async def fully_update_data_source(
    data_source_id: _INT32_POS,
    update_data: models.DataSourceUpdate,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # --- STEP 1: Update the main DataSource table directly and robustly ---
    update_values = {
        "Name": update_data.Name,
        "Description": update_data.Description,
        "IsActive": update_data.IsActive,
        "ModifiedDate": datetime.now(timezone.utc)
    }

    # This builds and executes an UPDATE statement with a simple WHERE clause.
    # synchronize_session=False is the key: it tells SQLAlchemy NOT to use
    # the complex versioned WHERE clause and to just trust us.
    updated_row_count = (
        db.query(dbtables.DataSource)
        .filter(dbtables.DataSource.DataSourceID == data_source_id)
        .update(update_values, synchronize_session=False) # This is the crucial part
    )


    print("AFTER UPDATE STATEMENT")
    # Manually check the result. This replaces the StaleDataError with a clearer HTTP error.
    if updated_row_count == 0:
        db.rollback()
        raise HTTPException(status_code=404, detail=f"Data Source with ID {data_source_id} not found")
    # if updated_row_count > 1:
    #     # This is our own sanity check for the impossible case of true duplicate PKs.
    #     db.rollback()
    #     raise HTTPException(status_code=500, detail="Critical error: Update affected multiple rows. True duplicate primary keys may exist.")

    # --- STEP 2: Now that the main update is done, handle the related fields ---
    # We fetch the now-updated object to work with its relationships.
    db_datasource = db.get(dbtables.DataSource, data_source_id)
    if not db_datasource: # Should be impossible, but safe to check
        db.rollback()
        raise HTTPException(status_code=404, detail="Data Source disappeared after update.")

    existing_fields_map = { fv.field.Name: fv for fv in db_datasource.field_values }
    print("- - - - - - - - - - - - - - - - - - - - - - - - - ")
    print("Debugging Field does not Exist error when updating:")
    print(existing_fields_map)
    print(update_data)
    print("- - - - - - - - - - - - - - - - - - - - - - - - - ")
    
    for field_name, new_field_value in update_data.Fields.items():
        field_to_update = existing_fields_map.get(field_name)
        if field_to_update:
            field_to_update.Value = new_field_value
        else:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Field '{field_name}' does not exist for this DataSource and cannot be updated."
            )

    # --- STEP 3: Commit the entire transaction ---
    # This will save the changes made to the field values.
    db.commit()
    
    # --- STEP 4: Construct and return the response ---
    # Refresh the object to ensure all relationships are fully loaded for the response.
    db.refresh(db_datasource)
    updated_fields = { fv.field.Name: fv.Value for fv in db_datasource.field_values }
    #response_data = models.DataSourceWithFieldDict.from_orm(db_datasource)
    response_data = models.DataSourceWithFieldDict(
        # Manually map attributes from the SQLAlchemy object to the Pydantic model
        DataSourceID=db_datasource.DataSourceID,
        Name=db_datasource.Name,
        Description=db_datasource.Description,
        DataSourceTypeID=db_datasource.DataSourceTypeID,
        IsActive=db_datasource.IsActive,
        ModifiedDate=db_datasource.ModifiedDate,
        isRefreshed=db_datasource.isRefreshed,
        RefreshedDate=db_datasource.RefreshedDate,
        
        # Use the dictionary you already created for the nested fields
        Fields=updated_fields 
    )
    response_data.Fields = updated_fields

    # --- Step 5: Update all related Data Sets to match the Data Source's IsActive status if they don't already match ---
    # This is a simple bulk update that sets IsActive to match the Data Source for all Data Sets linked to this Data Source.
    db.query(dbtables.DataSet)\
        .filter(dbtables.DataSet.DataSourceID == data_source_id)\
        .filter(dbtables.DataSet.IsActive != update_data.IsActive)\
        .update({"IsActive": update_data.IsActive}, synchronize_session=False)
    db.commit() # Commit the changes to the Data Sets

    audit(
        event="datasource.update", action="update", result="success",
        upn=auth_info["upn"], method="PUT", path=f"/api/DataSource/Update/{data_source_id}",
        item_type="DataSource", item_id=data_source_id,
        status_code=200,
    )
    return response_data

@router.post(
    "/Add",
    response_model=models.DataSourceWithFieldDict,
    #status_code=status.HTTP_201_CREATED,
    summary="Create a new Data Source with its fields"
)
async def create_data_source(
    create_data: models.DataSourceCreate,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    try:
        # --- 0. Verify if the Name already exists ---
        existing_ds = db.query(dbtables.DataSource).filter(
            dbtables.DataSource.Name == create_data.Name, 
            dbtables.DataSource.IsActive != 2).first()
        if existing_ds:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A Data Source with the name '{create_data.Name}' already exists."
            )

        # --- 1. Create the main DataSource object ---
        new_datasource = dbtables.DataSource(
            Name=create_data.Name,
            Description=create_data.Description,
            DataSourceTypeID=create_data.DataSourceTypeID,
            IsActive=create_data.IsActive,
            ModifiedDate=datetime.now(timezone.utc),
            isRefreshed=False,
            RefreshedDate=None
        )

        # If the Data Type is REDCap, set the Refreshed Date to now
        if new_datasource.DataSourceTypeID == REDCAP_DATASOURCE_TYPE_ID:
            new_datasource.isRefreshed = True
            now = datetime.now(timezone.utc)
            new_datasource.RefreshedDate = now.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            
        # --- 2. Handle the nested 'Fields' (if any) ---
        if create_data.Fields:
            # Get all field objects from the database
            db_fields = (
                db.query(dbtables.Field)
                .filter(dbtables.Field.Name.in_(create_data.Fields.keys()))
                .all()
            )
            print("Debugging: ")
            print(db_fields)
            print(create_data.Fields.keys())
            # Check if all provided fields exist
            fields_map = {field.Name: field for field in db_fields}
            print(fields_map)
            if len(db_fields) != len(create_data.Fields):
                missing_fields = set(create_data.Fields.keys()) - set(fields_map.keys())
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Fields do not exist: {', '.join(missing_fields)}"
                )
            
            # Create field value associations
            for field_name, field_value in create_data.Fields.items():
                field_obj = fields_map[field_name]
                new_field_value_link = dbtables.DataSourceFieldValue(
                    FieldID=field_obj.FieldID,
                    Value=field_value.replace('\\', '\\\\')
                )
                new_datasource.field_values.append(new_field_value_link)
        
        # --- 3. Save to database ---
        db.add(new_datasource)
        db.commit()
        
        # --- 4. Refresh to get the complete object with relationships ---
        db.refresh(new_datasource, ['field_values'])
        
        # --- 5. Build the response ---
        fields_dict = {
            fv.field.Name: fv.Value
            for fv in new_datasource.field_values
        }
        
        response_model = models.DataSourceWithFieldDict(
            DataSourceTypeID=new_datasource.DataSourceTypeID,
            DataSourceID=new_datasource.DataSourceID,
            Name=new_datasource.Name,
            Description=new_datasource.Description,
            isRefreshed=new_datasource.isRefreshed,
            ModifiedDate=new_datasource.ModifiedDate,
            IsActive=new_datasource.IsActive,
            RefreshedDate=new_datasource.RefreshedDate,
            Fields=fields_dict
        )
        
        audit(
            event="datasource.create", action="create", result="success",
            upn=auth_info["upn"], method="POST", path="/api/DataSource/Add",
            item_type="DataSource", item_id=new_datasource.DataSourceID,
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
    
# @router.post(
#     "/Add", # No path parameter needed for creation
#     response_model=models.DataSourceWithFieldDict,
#     status_code=status.HTTP_201_CREATED, # Use 201 Created for successful creation
#     summary="Create a new Data Source with its fields"
# )
# async def create_data_source(
#     create_data: models.DataSourceCreate, # Use the new "Create" Pydantic model
#     db: Session = Depends(database.get_db)
# ):
#     try:
#         # --- 1. Create the main DataSource object ---
#         new_datasource = dbtables.DataSource(
#             Name=create_data.Name,
#             Description=create_data.Description,
#             DataSourceTypeID=create_data.DataSourceTypeID,
#             IsActive=create_data.IsActive,
#             ModifiedDate=datetime.now(timezone.utc),
#             isRefreshed=True,
#             RefreshedDate=datetime.now(timezone.utc)
#         )

#         # --- 2. Handle the nested 'Fields' ---
#         # We need to find the corresponding Field objects in the database
#         # to link them in the DataSourceFieldValue association table.

#         # Get all the field names the client provided
#         field_names_from_payload = create_data.Fields.keys()

#         if field_names_from_payload:
#             # Query the database to get the actual Field objects for these names
#             # This is an efficient way to get them all in one query.
#             db_fields = (
#                 db.query(dbtables.Field)
#                 .filter(dbtables.Field.Name.in_(field_names_from_payload))
#                 .all()
#             )
            
#             # Create a lookup map for easy access
#             fields_map = {field.Name: field for field in db_fields}

#             # Check for any fields that were provided but not found in the database
#             if len(db_fields) != len(field_names_from_payload):
#                 provided_set = set(field_names_from_payload)
#                 found_set = set(fields_map.keys())
#                 missing_fields = provided_set - found_set
#                 raise HTTPException(
#                     status_code=400,
#                     detail=f"The following fields do not exist and cannot be assigned: {', '.join(missing_fields)}"
#                 )

#             # --- 3. Create the DataSourceFieldValue association objects ---
#             for field_name, field_value in create_data.Fields.items():
#                 field_obj = fields_map[field_name]
                
#                 # Create the association object
#                 new_field_value_link = dbtables.DataSourceFieldValue(
#                     FieldID=field_obj.FieldID,
#                     Value=field_value
#                 )
                
#                 # Append it to the new DataSource's relationship collection.
#                 # This links them together in SQLAlchemy's session.
#                 new_datasource.field_values.append(new_field_value_link)

#         # --- 4. Add the new DataSource (and its linked field_values) to the session ---
#         db.add(new_datasource)
        
#         # --- 5. Commit the transaction ---
#         # This will save the DataSource and all the DataSourceFieldValue records at once.
#         db.commit()
        
#         # --- 6. Refresh the object to get DB-generated values (like the new ID) ---
#         # db.refresh(new_datasource)
        
#         # # --- 7. Construct and return the response ---
#         # # We need to manually build the response model because the relationships are fresh.
#         # created_fields = {
#         #     fv.field.Name: fv.Value
#         #     for fv in new_datasource.field_values
#         # }
        
#         # response_data = models.DataSourceWithFieldDict(
#         #     DataSourceID=new_datasource.DataSourceID,
#         #     Name=new_datasource.Name,
#         #     Description=new_datasource.Description,
#         #     DataSourceTypeID=new_datasource.DataSourceTypeID,
#         #     IsActive=new_datasource.IsActive,
#         #     ModifiedDate=new_datasource.ModifiedDate,
#         #     isRefreshed=new_datasource.isRefreshed,
#         #     RefreshedDate=new_datasource.RefreshedDate,
#         #     Fields=created_fields
#         # )

#          # --- 6. Re-query the object to get a fresh instance with all relationships ---
#         # Get the ID from the committed object before the session is closed/changed
#         new_id = new_datasource.DataSourceID
#         db.close() # Good practice to close the session

#         # Get a new session to fetch the committed data
#         db = database.SessionLocal() # Or however you create a new session
        
#         created_datasource = (
#             db.query(dbtables.DataSource)
#             .options(
#                 joinedload(dbtables.DataSource.field_values)
#                 .joinedload(dbtables.DataSourceFieldValue.field)
#             )
#             .filter(dbtables.DataSource.DataSourceID == new_id)
#             .first()
#         )

#         # 1. Handle the case where the new datasource isn't found for some reason
#         if not created_datasource:
#             raise HTTPException(status_code=404, detail="Newly created data source not found")

#         # 2. Create the dictionary for the 'Fields' attribute, just like in your loop
#         #    but for the single 'created_datasource' object.
#         fields_dict = {
#             fv.field.Name: fv.Value
#             for fv in created_datasource.field_values
#         }

#         # 3. Instantiate your Pydantic model with the data from the SQLAlchemy object
#         response_model = models.DataSourceWithFieldDict(
#             DataSourceTypeID=created_datasource.DataSourceTypeID,
#             DataSourceID=created_datasource.DataSourceID,
#             Name=created_datasource.Name,
#             Description=created_datasource.Description,
#             isRefreshed=created_datasource.isRefreshed,
#             ModifiedDate=created_datasource.ModifiedDate,
#             IsActive=created_datasource.IsActive,
#             RefreshedDate=created_datasource.RefreshedDate,
#             Fields=fields_dict
#         )
      
        
#         print(f"DEBUG: Returning data: {response_model.model_dump_json(indent=2)}")
#         return response_model

#     except Exception as e:
#         db.rollback()
#         # It's good practice to log the actual error for debugging
#         # import traceback; traceback.print_exc();
#         if isinstance(e, HTTPException):
#             raise e # Re-raise HTTPExceptions so FastAPI can handle them
#         raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

# @router.put(
#     "/debug/raw-update/{data_source_id}",
#     response_model=RawUpdateResult,
#     summary="DEBUG: Perform a raw SQL update and get the row count.",
#     tags=["DataSource", "Debugging"]
# )
# async def perform_raw_update(data_source_id: int, db: Session = Depends(database.get_db)):
#     """
#     Bypasses the SQLAlchemy ORM to send a raw UPDATE statement and return
#     the exact number of rows the database engine reports as affected.
#     This is the definitive test for the StaleDataError.
#     """
#     sql_query = text(
#         'UPDATE dbo.DataSource SET Name = :name WHERE DataSourceID = :id'
#     )
    
#     try:
#         # We use db.execute() which returns a result proxy
#         result = db.execute(
#             sql_query, 
#             {"name": f"Raw Update Test {datetime.now()}", "id": data_source_id}
#         )
#         # The .rowcount attribute contains the number of rows affected.
#         rows_affected = result.rowcount
        
#         db.commit() # Commit the change
#         
#         return RawUpdateResult(rows_affected=rows_affected)


@router.get("/sync-redcap/{data_source_id}")
async def sync_redcap_data(
    data_source_id: _INT32_POS,
    db: Session = Depends(database.get_db)
):
    # Ensure the DataSource exists before attempting to read its fields
    ds_exists = db.query(dbtables.DataSource).filter(dbtables.DataSource.DataSourceID == data_source_id).first()
    if not ds_exists:
        raise HTTPException(status_code=404, detail=f"DataSource with ID {data_source_id} not found")

    # Retrieve configuration from DB (REDCap URL -> ID 4, REDCap API Key -> ID 5)
    # Optimization: Query DataSourceFieldValue directly by FieldID to avoid JOIN overhead.
    fields = (
        db.query(dbtables.DataSourceFieldValue.Value, dbtables.DataSourceFieldValue.FieldID)
        .filter(dbtables.DataSourceFieldValue.DataSourceID == data_source_id)
        .filter(dbtables.DataSourceFieldValue.FieldID.in_([4, 5]))
        .all()
    )
    
    config_map = {field_id: value for value, field_id in fields}
    api_url = config_map.get(4) # FieldID 4 is REDCap URL
    api_k = config_map.get(5)   # FieldID 5 is REDCap API Key

    try:
        # Import redcap here to avoid module-level dependency
        from redcap import Project

        # Initialize the project
        project = Project(api_url, api_k)

        # Pull the full metadata
        raw_metadata = project.export_metadata()

        # Keep only the keys you want
        keys_to_keep = ['field_name', 'field_label', 'field_type', 'select_choices_or_calculations']

        refined_metadata = [
            {k: field[k] for k in keys_to_keep} 
            for field in raw_metadata
        ]

        return {
            "status": "success",
            "metadata": refined_metadata
        }


        # To get the column names, we pull the 'field_names' 
        # This is much faster than exporting all records
        # column_names = project.field_names

        # return {
        #     "status": "success",
        #     "columns_detected": column_names
        # }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# # @router.get("/GetConnectionList", response_model=List[models.LoomeIntegrateConnection])
# # async def get_connection_list():
# #     return [{"id": 1, "name": "SQL Connection", "connectionType": "Microsoft SQL Server"}]

# # @router.get("/GetDataSourceFieldValues", response_model=List[models.DataSourceFieldValue])
# # async def get_datasource_field_values(
# #     dataSourceID: Optional[int] = None,
# #     db: Session = Depends(database.get_db),
# # ):
# #     # Query SQLAlchemy rows
# #     q = db.query(dbtables.DataSourceFieldValue)
# #     if dataSourceID is not None:
# #     ]

# # # @router.get("/TypeAhead", response_model=List[models.DataSource])
# # # async def type_ahead(name: str = None):
# # #     return [
# # #         {
# # #             "dataSourceID": 1,
# # #             "name": "Sample DataSource",
# # #             "description": "A sample data source.",
# # #             "isRefreshed": True,
# # #             "modifiedDate": "2025-08-19T12:00:00Z",
# # #         }
# # #     ]

# # @router.get("/{id}", response_model=models.DataSource)
# # async def get_datasource_by_id(id: int):
# #     return {
# #         "dataSourceID": id,
# #         "name": "Sample DataSource",
# #         "description": "A sample data source.",
# #         "isRefreshed": True,
# #         "modifiedDate": "2025-08-19T12:00:00Z",
# #     }

# # # @router.post("", response_model=models.DataSource)
# # # async def create_datasource(datasource: models.DataSource):
# # #     return datasource

# # # @router.put("/{id}")
# # # async def update_datasource(id: int, datasource: models.DataSource):
# # #     return {"message": "DataSource updated successfully"}

@router.put("/{id}/Cancel", status_code=status.HTTP_200_OK)
async def cancel_datasource(
    id: _INT32_POS,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    """
    Marks a single DataSource as cancelled by setting IsActive to 2 instead of deleting.
    Also marks all related configurations (tables, folders, field values) as cancelled.
    IsActive=2 indicates the DataSource and related records have been cancelled/deleted.
    Returns an error if any DataSets are still linked to this DataSource.
    """
    # 1. Check if any DataSets are using this DataSource
    linked_datasets = db.query(dbtables.DataSet).filter(
        dbtables.DataSet.DataSourceID == id,
        dbtables.DataSet.IsActive != 2
    ).all()
    if linked_datasets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete this DataSource because it is currently linked to {len(linked_datasets)} DataSet(s). Delete the DataSets first."
        )

    # 2. Find the DataSource
    db_datasource = db.query(dbtables.DataSource).filter(dbtables.DataSource.DataSourceID == id).first()
    if not db_datasource:
        raise HTTPException(status_code=404, detail=f"DataSource with ID {id} not found")

    # Soft delete: Mark all related records as cancelled (IsActive=2) instead of deleting them
    # IsActive=2 indicates records have been cancelled/deleted
    from datetime import datetime
    current_time = datetime.now()
    
    try:
        # 1. Mark associated Tables as cancelled
        db.query(dbtables.DataSourceTables).filter(
            dbtables.DataSourceTables.DataSourceId == id
        ).update(
            {dbtables.DataSourceTables.isActive: 2, dbtables.DataSourceTables.ModifiedDate: current_time},
            synchronize_session=False
        )
        
        # 2. Mark associated Folders as cancelled
        db.query(dbtables.DataSourceFolders).filter(
            dbtables.DataSourceFolders.DataSourceId == id
        ).update(
            {dbtables.DataSourceFolders.isActive: 2, dbtables.DataSourceFolders.ModifiedDate: current_time},
            synchronize_session=False
        )
       
        # 3. Mark related field values as cancelled
        db.query(dbtables.DataSourceFieldValue).filter(
            dbtables.DataSourceFieldValue.DataSourceID == id
        ).update(
            {dbtables.DataSourceFieldValue.IsActive: 2, dbtables.DataSourceFieldValue.ModifiedDate: current_time},
            synchronize_session=False
        )

        # 4. Mark the primary DataSource record as cancelled
        db_datasource.IsActive = 2
        db_datasource.ModifiedDate = current_time
        db.commit()
        audit(
            event="datasource.cancel", action="cancel", result="success",
            upn=auth_info["upn"], method="PUT", path=f"/api/DataSource/{id}/Cancel",
            item_type="DataSource", item_id=id,
            status_code=200,
        )
        return {"message": f"DataSource {id} and all related configurations marked as cancelled successfully."}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An error occurred during cancellation: {str(e)}")
