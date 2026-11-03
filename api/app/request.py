from fastapi import APIRouter, HTTPException, Request, Depends, Query, Security, status
from typing import Annotated, List
from app.VerifyHeaders import verify_headers
from app.audit import audit
from fastapi.security import APIKeyHeader
from sqlalchemy import func, or_
import models.models as models
from models.models import _INT32_POS
from fastapi import Depends
from sqlalchemy.orm import Session
from .helper  import get_paged_result
# from app 
import database
import math
from . import dbtables




router = APIRouter(
    prefix="/api/Request",
    tags=["Request"],
)

  
def _map_request_to_model(req: dbtables.Request) -> models.Request:
    """
    Converts a dbtables.Request SQLAlchemy object to a models.Request Pydantic object.
    """
    return models.Request(
        RequestID=req.RequestID,
        Name=req.Name,
        Purpose=req.Purpose,
        CreateDate=req.CreateDate,
        ModifiedDate=req.ModifiedDate,
        ApprovedDate=req.ApprovedDate,
        RejectedDate=req.RejectedDate,
        FinalisedDate=req.FinalisedDate,
        StatusID=req.StatusID,
        ProjectID=req.ProjectID,
        DataSetID=req.DataSetID,
        Approvers=req.Approvers,
        CurrentlyApproved=req.CurrentlyApproved,
        RejectedBy=req.RejectedBy,
        CreateUser=req.CreateUser,
        ApprovalMessage=req.ApprovalMessage,
        RejectionMessage=req.RejectionMessage,
        Orphaned=req.Orphaned
    )

 
 

@router.get("/", response_model=models.RequestPagedResult)
async def get_request_by_upn(
    page: int = 1,
    pageSize: int = 5,
    search: str = Query(None),
    statusId: int = 1,
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
   
   
    upn = auth_info["upn"]
    print (f"UPN from headers: {upn}")

    # --- 1. Build the base query and apply filters ---
    db_requests = db.query(dbtables.Request).filter(dbtables.Request.CreateUser.contains(upn)).filter(dbtables.Request.StatusID == statusId)
    
    # --- 2. Apply search filter if provided ---
    if search:
        lower_search_term = f"%{search.lower()}%"
        db_requests = db_requests.filter(
            or_(
                func.lower(dbtables.Request.Name).like(lower_search_term)
            )
        ) 

        
    
    results = [_map_request_to_model(req) for req in db_requests.all()]
    return get_paged_result(results, page, pageSize)

@router.get("/List", response_model=models.RequestPagedResult)
async def get_approval_list_for_upn(
    page: int = 1,
    pageSize: int = 5,
    search: str = Query(None),
    statusId: int = 1,
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    
    upn = auth_info["upn"]
    print (f"UPN from headers: {upn}")

    # --- 1. Build the base query and apply filters ---
    db_requests = db.query(dbtables.Request).filter(dbtables.Request.Approvers.contains(upn)).filter(dbtables.Request.StatusID == statusId)
    
    # --- 2. Apply search filter if provided ---
    if search:
        lower_search_term = f"%{search.lower()}%"
        db_requests = db_requests.filter(
            or_(
                func.lower(dbtables.Request.Name).like(lower_search_term)
            )
        ) 
   
        
    print(f"Database returned requests: {len(db_requests.all())}")
    results = [_map_request_to_model(req) for req in db_requests.all()]
    return get_paged_result(results, page, pageSize)
 
 # -- For PLatform Administrators to see all requests --

@router.get("/All", response_model=models.RequestPagedResult)
async def get_request_list_for_admin(
    page: int = 1,
    pageSize: int = 5,
    search: str = Query(None),
    statusId: int = 1,
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    


    # --- 1. Build the base query and apply filters ---
    db_requests = db.query(dbtables.Request).filter(dbtables.Request.StatusID == statusId)
    
    # --- 2. Apply search filter if provided ---
    if search:
        lower_search_term = f"%{search.lower()}%"
        db_requests = db_requests.filter(
            or_(
                func.lower(dbtables.Request.Name).like(lower_search_term)
            )
        ) 
   
    results = [_map_request_to_model(req) for req in db_requests.all()]
    return get_paged_result(results, page, pageSize)
 


#Order in this file is IMPORTANT



# GET /api/Request/GetLoomeAssistProjectsList
@router.get("/AssistProjects/All", response_model=models.LoomeAssistProjectPagedResult)
async def get_loome_assist_projects_list_all(
    page: int = 1,
    page_size: int = 5,
    db: Session = Depends(database.get_db)
    ):
    

    projects = db.query(dbtables.LoomeAssistProjects).join(
        dbtables.LoomeAssistProjectsUsers,
        dbtables.LoomeAssistProjects.LoomeAssistProjectsID == dbtables.LoomeAssistProjectsUsers.LoomeAssistProjectsID
    ).filter(
        dbtables.LoomeAssistProjects.Name.notilike("%Airlock%"),
        dbtables.LoomeAssistProjects.Name.notilike("%Import%")
    ).all()

    # Map database objects to Pydantic models
    results = [
        models.LoomeAssistProject(
            AssistProjectID=p.AssistProjectID,
            Name=p.Name,
            Description=p.Description,
            IsActive=p.IsActive,
            ModifiedDate=p.ModifiedDate,
            LoomeAssistTenantsID=p.LoomeAssistTenantsID,
            DeletedDate=p.DeletedDate
        ) for p in projects
    ]

    return  get_paged_result( results, page, page_size)

 

@router.get("/AssistProjects", response_model=models.LoomeAssistProjectPagedResult)
async def get_loome_assist_projects_list_filtered_by_upn(
    page: int = 1,
    page_size: int = 5,
    db: Session = Depends(database.get_db),
    auth_info: dict = Depends(verify_headers),
    ):
    
    upn = auth_info["upn"]
    print (f"UPN from headers: {upn}")


    projects = db.query(dbtables.LoomeAssistProjects).join(
        dbtables.LoomeAssistProjectsUsers,
        dbtables.LoomeAssistProjects.LoomeAssistProjectsID == dbtables.LoomeAssistProjectsUsers.LoomeAssistProjectsID
    ).filter(
        dbtables.LoomeAssistProjectsUsers.Username == upn,
        dbtables.LoomeAssistProjects.Name.notilike("%Airlock%"),
        dbtables.LoomeAssistProjects.Name.notilike("%Import%")
    ).order_by(dbtables.LoomeAssistProjects.Name).all()

    # projects = db.query(dbtables.LoomeAssistProjects).all()

    print(f"Database returned projects: {len(projects)}")
    print ("project1: ", [p for p in projects ])
    # Map database objects to Pydantic models
    results = [
        models.LoomeAssistProject(
            AssistProjectID=p.AssistProjectID,
            Name=p.Name,
            Description=p.Description,
            IsActive=p.IsActive,
            ModifiedDate=p.ModifiedDate,
            LoomeAssistTenantsID=p.LoomeAssistTenantsID,
            DeletedDate=p.DeletedDate
        ) for p in projects
    ]



    return  get_paged_result( results, page, page_size)
    # page result 


 

# add an endpoint to get request by id as a url /{id}
@router.get("/{id}", response_model=models.Request)
async def get_request_by_id(
    id: _INT32_POS, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)):
    
    
    upn = auth_info["upn"]
    print (f"UPN from headers: {upn}")

    req = db.query(dbtables.Request).filter(dbtables.Request.RequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # No upn filter for the Admin to see all Requests
    # user_lower = upn.lower()
    # if not (
    #     (req.Approvers and user_lower in req.Approvers.lower()) or 
    #     (req.CreateUser and user_lower == req.CreateUser.lower()) or 
    #     (req.CurrentlyApproved and user_lower in req.CurrentlyApproved.lower())
    # ):
    #     raise HTTPException(status_code=403, detail="Not authorized to access this request")
    return _map_request_to_model(req)


# add an endpoint to approve a request by id as a url /Approve/{id}
@router.post("/{id}/Approve", response_model=models.Request)
async def approve_request_by_id(
    id: _INT32_POS, 
    reason: str = Query(..., max_length=500),
    auth_info: dict = Depends(verify_headers), 
    db: Session = Depends(database.get_db)):

    upn = auth_info["upn"]
    print (f"UPN from headers: {upn}")

    req = db.query(dbtables.Request).filter(dbtables.Request.RequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    print("Approvesrs: ", req.Approvers)
    print("CreateUser: ", req.CreateUser)
    print("UPN: ", upn)
     
    if upn.lower() not in req.Approvers: # if upn not in req.Approvers:
        raise HTTPException(status_code=403, detail="Not authorized to access this request")
    # Update the request status to approved (assuming statusID 2 means approved)
    req.StatusID = 2
    req.ApprovedDate = func.now()
    req.CurrentlyApproved = upn.lower()
    req.ApprovalMessage = reason
    db.commit()
    db.refresh(req)

    audit(
        event="request.approve",
        action="approve",
        result="success",
        upn=upn,
        method="POST",
        path=f"/api/Request/{id}/Approve",
        item_type="Request",
        item_id=id,
        status_code=200,
    )

    return _map_request_to_model(req)

# add an endpoint to reject a request by id as a url /Reject/{id}
@router.post("/{id}/Reject", response_model=models.Request)
async def reject_request_by_id(
    id: _INT32_POS, 
    reason: str = Query(..., max_length=500),
    auth_info: dict = Depends(verify_headers), 
    db: Session = Depends(database.get_db)):

    upn = auth_info["upn"]
 
    print (f"UPN from headers: {upn}")

    req = db.query(dbtables.Request).filter(dbtables.Request.RequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
        
    user_lower = upn.lower()
    if not (
        (req.Approvers and user_lower in req.Approvers.lower())
    ):
        raise HTTPException(status_code=403, detail="Not authorized to access this request")
    # Update the request status to approved (assuming statusID 2 means approved)
    req.StatusID = 4
    req.RejectedDate = func.now()
    req.RejectedBy = upn.lower()
    req.RejectionMessage = reason
    db.commit()
    db.refresh(req)

    audit(
        event="request.reject",
        action="reject",
        result="success",
        upn=upn,
        method="POST",
        path=f"/api/Request/{id}/Reject",
        item_type="Request",
        item_id=id,
        status_code=200,
    )

    return _map_request_to_model(req)

# endpoint to reject a request by id



@router.put("/{id}/Cancel", response_model=models.Request)
async def cancel_request_by_id(
    id: _INT32_POS, 
    auth_info: dict = Depends(verify_headers), 
    db: Session = Depends(database.get_db)):

    upn = auth_info["upn"]
 
    print (f"UPN from headers: {upn}")

    req = db.query(dbtables.Request).filter(dbtables.Request.RequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if upn.lower() not in req.CreateUser:  # if upn not in req.Approvers:
        raise HTTPException(status_code=403, detail="Not authorized to access this request")

    # Soft delete: Set StatusID to 5 (cancelled) instead of deleting the record
    # StatusID=5 indicates the request has been cancelled/deleted
    from datetime import datetime
    req.StatusID = 5
    req.ModifiedDate = datetime.now()
    db.commit()
    db.refresh(req)
    audit(
        event="request.cancel", action="cancel", result="success",
        upn=upn, method="PUT", path=f"/api/Request/{id}/Cancel",
        item_type="Request", item_id=req.RequestID,
        status_code=200, project_id=req.ProjectID,
    )
    return _map_request_to_model(req)

# Get Request by DataSet ID
@router.get("/DataSet/{data_set_id}")
async def get_requests_by_data_set_id(
    data_set_id: _INT32_POS, 
    auth_info: dict = Depends(verify_headers), 
    db: Session = Depends(database.get_db)
) -> bool:
    upn = auth_info["upn"]
    print (f"UPN from headers: {upn}")

    request_exists = db.query(dbtables.Request).filter(
        dbtables.Request.DataSetID == data_set_id,
        dbtables.Request.StatusID != 5
    ).first() is not None
    
    return request_exists