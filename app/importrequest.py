from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import Optional
from app.VerifyHeaders import verify_headers
from sqlalchemy import func, or_
import models.models as models
from models.models import _INT32_POS, _STATUS_ID
from sqlalchemy.orm import Session
from datetime import datetime
import asyncio
import database
from . import dbtables

from PortalLib import IntegrateLib, AssistLib
from .audit import audit
from .request_coordination import (
    get_active_import_request,
    try_acquire_project_lock,
    wait_for_integrate_request,
)

from .helper import get_paged_result

router = APIRouter(
    prefix="/api/ImportRequest",
    tags=["ImportRequest"],
)


@router.post("/WithJob", response_model=models.ImportRequest)
async def create_import_request_with_job(
    importRequestName: str = Query(..., max_length=100),
    loomeAssistTenantsID: str = Query(...),
    loomeAssistName: Optional[str] = None,
    projectID: Optional[_INT32_POS] = None,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    """Create an Integrate job and wait for its database request record."""
    upn = auth_info["upn"]
    if projectID is None:
        raise HTTPException(status_code=400, detail="projectID is required")

    print(f"Import request received: project={projectID}, user={upn}", flush=True)

    # Keep the lock only for this short database check. Never hold it while
    # calling Integrate or waiting for the PowerShell-created request row.
    if not try_acquire_project_lock(db, "Import", projectID, timeout_ms=1000):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An import request is already being processed for this project.",
        )
    active_request = get_active_import_request(db, projectID)
    if active_request is not None:
        # Status 6 is a terminal conflict record for the attempted request;
        # only -1, 0, 1, and 2 represent an active request that blocks a new
        # import for this project.
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "An active import request already exists for this project "
                f"(ImportRequestID={active_request.ImportRequestID}, "
                f"StatusID={active_request.StatusID})."
            ),
        )
    db.commit()

    try:
        print(f"Starting import Integrate job: project={projectID}", flush=True)
        token = await asyncio.to_thread(IntegrateLib.get_integrate_bearer_token)
        job = await asyncio.to_thread(
            IntegrateLib.CreateDataImport,
            token, importRequestName, projectID, loomeAssistTenantsID,
            loomeAssistName, upn,
        )
        if not job or not job.get("jobId"):
            raise RuntimeError("Loome Integrate returned no import job ID")

        db_req = await wait_for_integrate_request(
            db,
            dbtables.ImportRequest,
            job["jobId"],
            projectID,
            upn,
        )
        if db_req is None:
            # Integrate normally inserts a StatusID=6 row for a conflict.
            # Reaching this branch therefore indicates that the job failed,
            # timed out, or did not persist its request row. Recheck the
            # active-request race separately before returning a gateway error.
            if not try_acquire_project_lock(db, "Import", projectID, timeout_ms=1000):
                try:
                    await asyncio.to_thread(
                        IntegrateLib.DeleteIntegrateJob, token, job["jobId"]
                    )
                except Exception as cleanup_error:
                    print(
                        f"Failed to clean up import job after lock timeout: {cleanup_error}",
                        flush=True,
                    )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An import request is already being processed for this project.",
                )
            active_request = get_active_import_request(db, projectID)
            db.rollback()
            if active_request is not None:
                try:
                    await asyncio.to_thread(
                        IntegrateLib.DeleteIntegrateJob, token, job["jobId"]
                    )
                except Exception as cleanup_error:
                    print(
                        f"Failed to clean up rejected import job: {cleanup_error}",
                        flush=True,
                    )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "A non-finalised import request already exists for this project "
                        f"(ImportRequestID={active_request.ImportRequestID}, "
                        f"StatusID={active_request.StatusID})."
                    ),
                )
            raise RuntimeError(
                "Integrate did not insert the import request record before timeout"
            )

        if db_req.StatusID == 6:
            # Integrate inserts the attempted request with StatusID=6 when it
            # detects an existing non-finalised import request. The job has
            # already stopped, so preserve the row for audit/history and do
            # not attempt job cleanup.
            conflict_request_id = db_req.ImportRequestID
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A non-finalised import request already exists for this project. "
                    f"Conflicting ImportRequestID={conflict_request_id}. StatusID=6."
                ),
            )

        # Integrate records rejected duplicate attempts with StatusID=6. A
        # row reaching this point is a normal, non-conflicting request.
        print(f"Import request completed: request={db_req.ImportRequestID}", flush=True)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=f"Failed to create import request job: {exc}",
        ) from exc

    audit(
        event="import_request.create_with_job", action="create",
        result="success", upn=upn, method="POST",
        path="/api/ImportRequest/WithJob", item_type="ImportRequest",
        item_id=db_req.ImportRequestID, status_code=200,
        project_id=db_req.ProjectID, job_id=str(db_req.JobID),
    )
    return _map_import_request(db_req)


def _map_import_request(req: dbtables.ImportRequest) -> models.ImportRequest:
    return models.ImportRequest(
        ImportRequestID=req.ImportRequestID,
        ImportProjectID=req.ImportProjectID,
        JobID=req.JobID,
        ImportProjectName=req.ImportProjectName,
        ImportRequestName=req.ImportRequestName,
        ProjectName=req.ProjectName,
        ProjectID=req.ProjectID,
        StatusID=req.StatusID,
        CreateDate=req.CreateDate,
        CreateUser=req.CreateUser,
        ApprovedDate=req.ApprovedDate,
        ApprovedBy=req.ApprovedBy,
        FinalisedDate=req.FinalisedDate,
        RejectedDate=req.RejectedDate,
        RejectedBy=req.RejectedBy,
        ApprovalMessage=req.ApprovalMessage,
        RejectionMessage=req.RejectionMessage,
        Orphaned=req.Orphaned,
    )


def _mark_import_request_if_orphaned(
    req: dbtables.ImportRequest,
    db: Session,
) -> bool:
    """Handle missing projects without overwriting request lifecycle states.

    Conflict requests must remain terminal. A missing generated Import project
    ID is also expected briefly while Integrate is provisioning the project,
    so it is not treated as an orphan.
    """
    if req.StatusID == 6:
        return False

    if req.Orphaned is not None:
        return False

    # The source project is required to start the Integrate workflow. If it
    # disappears, mark the request according to its lifecycle stage rather
    # than incorrectly finalising a Working request.
    source_projects = db.query(dbtables.LoomeAssistProjects).filter(
        dbtables.LoomeAssistProjects.AssistProjectID == req.ProjectID
    ).all()
    source_missing = not source_projects or any(
        project.IsActive == 0 for project in source_projects
    )

    # ImportProjectID is populated asynchronously by Integrate. NULL does
    # not mean the project was deleted and must not orphan the request.
    import_project_missing = False
    if req.ImportProjectID is not None:
        import_projects = db.query(dbtables.LoomeAssistProjects).filter(
            dbtables.LoomeAssistProjects.AssistProjectID == req.ImportProjectID
        ).all()
        import_project_missing = not import_projects or any(
            project.IsActive == 0 for project in import_projects
        )

    if source_missing or import_project_missing:
        req.Orphaned = datetime.now()
        if req.StatusID in (-1, 0):
            req.StatusID = -2
        elif req.StatusID in (1, 2):
            req.StatusID = -2
        return True

    return False


# Get import requests filtered by the authenticated user's UPN (CreateUser)
@router.get("/List", response_model=models.ImportRequestPagedResult)
async def get_import_requests_by_upn(
    page: int = 1,
    pageSize: int = 10,
    search: str = Query(None),
    statusId: int = Query(None),
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    query = db.query(dbtables.ImportRequest).filter(
        dbtables.ImportRequest.CreateUser.contains(upn),
        dbtables.ImportRequest.StatusID.notin_([5, 6])
    )

    if statusId is not None:
        query = query.filter(dbtables.ImportRequest.StatusID == statusId)

    if search:
        lower_search = f"%{search.lower()}%"
        query = query.filter(
            or_(func.lower(dbtables.ImportRequest.ImportRequestName).like(lower_search))
        )

    results = [_map_import_request(req) for req in query.all()]
    return get_paged_result(results, page, pageSize)


# Update the StatusID of an import request
@router.put("/ForApproval/{id}", response_model=models.ImportRequest)
async def submit_import_request_for_approval(
    id: _INT32_POS,
    statusID: _STATUS_ID,
    importProjectID: _INT32_POS,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    req = db.query(dbtables.ImportRequest).filter(dbtables.ImportRequest.ImportRequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Import request not found")

    # Lookup the Assist Project details to get Tenant ID and Name
    assist_project = db.query(dbtables.LoomeAssistProjects).filter(
        dbtables.LoomeAssistProjects.AssistProjectID == req.ImportProjectID
    ).first()

    if importProjectID != req.ImportProjectID:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="importProjectID does not match this ImportRequest's ImportProjectID"

        )



    # Remove the user from the Import Project
    if assist_project:
        try:
            _token = IntegrateLib.get_integrate_bearer_token()
            _export_job = IntegrateLib.RemoveReadersFromImportProject(
                _token,

                req.ImportProjectID,

                assist_project.LoomeAssistTenantsID,

                assist_project.Name,

                upn
            )
            print(_export_job)
        except Exception as e:
            print(f"Error removing user from Import Project: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to remove user from Import Project: {str(e)}")
    else:
        print(f"Warning: No associated Assist project found for ImportProjectID {req.ImportProjectID}")
        
    # Update the StatusID of the import request
    req.StatusID = statusID
    db.commit()
    db.refresh(req)
    audit(
        event="import_request.update", action="update", result="success",
        upn=upn, method="PUT", path=f"/api/ImportRequest/Update/{id}",
        item_type="ImportRequest", item_id=req.ImportRequestID,
        status_code=200,
    )
    return _map_import_request(req)


# Approve an import request (StatusID=2, set ApprovedDate and ApprovedBy)
@router.post("/{id}/Approve", response_model=models.ImportRequest)
async def approve_import_request(
    id: _INT32_POS,
    reason: str = Query(..., max_length=500),
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    req = db.query(dbtables.ImportRequest).filter(dbtables.ImportRequest.ImportRequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Import request not found")

    if req.StatusID == 6:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Import request conflict records cannot be approved.",
        )

    if _mark_import_request_if_orphaned(req, db):
        db.commit()
        db.refresh(req)
        return _map_import_request(req)

    req.StatusID = 2
    req.ApprovedDate = datetime.now()
    req.ApprovedBy = upn.lower()
    req.ApprovalMessage = reason
    db.commit()
    db.refresh(req)
    audit(
        event="import_request.approve", action="approve", result="success",
        upn=upn, method="POST", path=f"/api/ImportRequest/{id}/Approve",
        item_type="ImportRequest", item_id=req.ImportRequestID,
        status_code=200, project_id=req.ImportProjectID,
        job_id=str(req.JobID) if req.JobID else None,
    )
    return _map_import_request(req)


# Reject an import request (StatusID=4, set RejectedDate and RejectedBy)
@router.post("/{id}/Reject", response_model=models.ImportRequest)
async def reject_import_request(
    id: _INT32_POS,
    reason: str = Query(..., max_length=500),
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    req = db.query(dbtables.ImportRequest).filter(dbtables.ImportRequest.ImportRequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Import request not found")

    if req.StatusID == 6:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Import request conflict records cannot be rejected again.",
        )

    if _mark_import_request_if_orphaned(req, db):
        db.commit()
        db.refresh(req)
        return _map_import_request(req)

    req.StatusID = 4
    req.RejectedDate = datetime.now()
    req.RejectedBy = upn.lower()
    req.RejectionMessage = reason
    db.commit()
    db.refresh(req)
    audit(
        event="import_request.reject", action="reject", result="success",
        upn=upn, method="POST", path=f"/api/ImportRequest/{id}/Reject",
        item_type="ImportRequest", item_id=req.ImportRequestID,
        status_code=200, project_id=req.ImportProjectID,
        job_id=str(req.JobID) if req.JobID else None,
    )
    return _map_import_request(req)


# Delete an import request (creator only)
@router.put("/{id}/Cancel", response_model=models.ImportRequest)
async def cancel_import_request(
    id: _INT32_POS,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    # Get import request details
    req = db.query(dbtables.ImportRequest).filter(dbtables.ImportRequest.ImportRequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Import request not found")
    
    if upn.lower() != req.CreateUser.lower():
        raise HTTPException(status_code=403, detail="Not authorized to delete this request")

    # Delete its Integrate job unless it is a status-6 conflict record. The
    # conflict job has already stopped when Integrate inserts that row.
    if req.StatusID != 6:
        try:
            auth_token = IntegrateLib.get_integrate_bearer_token()
            if req.JobID:
                IntegrateLib.DeleteIntegrateJob(auth_token, req.JobID)
        except Exception as e:
            print(f"Error deleting Integrate job with ID {req.JobID}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete associated Integrate job with ID {req.JobID}")
    
    # Delete its Repo and Solution Collection from its Assist Project in Loome Assist
    # Get the Repo ID using the ImportProjectID
    repo_record = db.query(dbtables.LoomeAssistProjectsDataRepos).\
        join(dbtables.LoomeAssistProjects, 
             dbtables.LoomeAssistProjectsDataRepos.LoomeAssistProjectsID == dbtables.LoomeAssistProjects.LoomeAssistProjectsID).\
        join(dbtables.ImportRequest, 
             dbtables.LoomeAssistProjects.AssistProjectID == dbtables.ImportRequest.ImportProjectID).\
        filter(dbtables.ImportRequest.ImportProjectID == req.ImportProjectID).\
        first()
    
    if repo_record is None:
        print(f"No associated Repo found for ImportProjectID {req.ImportProjectID}")
        # Conflict records may not have provisioned Assist resources because
        # the Integrate job stopped before creating them.
        if req.StatusID not in (-2, -1, 6):
            raise HTTPException(status_code=404, detail=f"No associated Repo found for ImportProjectID {req.ImportProjectID}")
    
    repoID = repo_record.SourceDataRepoID if repo_record else None
   
    if repo_record is not None:
        try:
            auth_token = AssistLib.get_assist_bearer_token()
            if req.ImportProjectID: 
                AssistLib.DeleteResources(auth_token, req.ImportProjectID, repoID, req.SolutionCollectionID)
            # Delete the repo record from database
            db.delete(repo_record)
        except Exception as e:
            print(f"Error deleting Assist resources for Project ID {req.ImportProjectID}, Repo ID {repoID}, Solution Collection ID {req.SolutionCollectionID}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete associated Assist resources for Project ID {req.ImportProjectID}")
    
    # Soft delete: set StatusID=5 (cancelled) instead of deleting the record.
    # Import request statuses:
    # -2 = failed or orphaned request
    # -1 = new request; Integrate job working
    #  0 = Integrate job complete; awaiting submission
    #  1 = submitted; awaiting approval
    #  2 = approved; awaiting finalisation
    #  3 = finalised
    #  4 = rejected by an approver
    #  5 = cancelled/deleted by the requester
    #  6 = conflict; another non-finalised import request exists
    from datetime import datetime
    req.StatusID = 5
    req.ModifiedDate = datetime.now()
    db.commit()
    db.refresh(req)
    audit(
        event="import_request.cancel", action="cancel", result="success",
        upn=upn, method="PUT", path=f"/api/ImportRequest/{id}/Cancel",
        item_type="ImportRequest", item_id=req.ImportRequestID,
        status_code=200, project_id=req.ImportProjectID,
        job_id=str(req.JobID) if req.JobID else None,
    )
    return _map_import_request(req)


# Get a single import request by ID (creator only)
@router.get("/{id}", response_model=models.ImportRequest)
async def get_import_request_by_id(
    id: _INT32_POS,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    req = db.query(dbtables.ImportRequest).filter(dbtables.ImportRequest.ImportRequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Import request not found")

    if req.StatusID == 6:
        raise HTTPException(status_code=404, detail="Import request not found")

    if not req.CreateUser or upn.lower() != req.CreateUser.lower():
        raise HTTPException(status_code=403, detail="Not authorized to access this request")

    return _map_import_request(req)


# Get all import requests with optional filtering by statusId and search
@router.get("/", response_model=models.ImportRequestPagedResult)
async def get_all_import_requests(
    page: int = 1,
    pageSize: int = 10,
    search: str = Query(None),
    statusId: int = Query(None),
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    query = db.query(dbtables.ImportRequest).filter(
        dbtables.ImportRequest.StatusID.notin_([5, 6])
    )

    if statusId is not None:
        query = query.filter(dbtables.ImportRequest.StatusID == statusId)

    if search:
        lower_search = f"%{search.lower()}%"
        query = query.filter(
            or_(func.lower(dbtables.ImportRequest.ImportRequestName).like(lower_search))
        )

    results = [_map_import_request(req) for req in query.all()]
    return get_paged_result(results, page, pageSize)


# Create a new import request with initial StatusID=-1 (draft)
# Legacy request-only endpoint disabled. Use POST /api/ImportRequest/WithJob.
# @router.post("/", response_model=models.ImportRequest)
async def create_import_request(
    importProjectID: _INT32_POS,
    importRequestName: str = Query(..., max_length=100),
    jobID: Optional[str] = None,
    importProjectName: Optional[str] = Query(None, max_length=500),
    projectName: Optional[str] = None,
    projectID: Optional[_INT32_POS] = None,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    from datetime import datetime
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    current_time = datetime.now()
    db_req = dbtables.ImportRequest(
        ImportProjectID=importProjectID,
        ImportRequestName=importRequestName,
        # The integration job is created server-side by dataimport.py. Do not
        # trust a client-supplied job ID as the authoritative association.
        JobID=None,
        ImportProjectName=importProjectName,
        ProjectName=projectName,
        ProjectID=projectID,
        StatusID=-1,
            # Import request statuses:
            # -2 = failed or orphaned request
            # -1 = new request; Integrate job working
            #  0 = Integrate job complete; awaiting submission
            #  1 = submitted; awaiting approval
            #  2 = approved; awaiting finalisation
            #  3 = finalised
            #  4 = rejected by an approver
            #  5 = cancelled/deleted by the requester
            #  6 = conflict; another non-finalised import request exists
        CreateDate=current_time,
        CreateUser=upn.lower(),
        ApprovedDate=None,
        FinalisedDate=None,
        RejectedDate=None,
        ApprovalMessage=None,
        RejectionMessage=None,
    )

    db.add(db_req)
    # Flush assigns the database-generated ImportRequestID while keeping the
    # transaction open. The ID is returned to the caller after the commit and
    # is then supplied to /api/DataImport/{projectId}.
    db.flush()
    db.commit() # Single commit at the end of the function
    db.refresh(db_req)
    audit(
        event="import_request.create", action="create", result="success",
        upn=upn, method="POST", path="/api/ImportRequest",
        item_type="ImportRequest", item_id=db_req.ImportRequestID,
        status_code=200, project_id=db_req.ImportProjectID,
        job_id=str(db_req.JobID) if db_req.JobID else None,
    )

    return _map_import_request(db_req)


