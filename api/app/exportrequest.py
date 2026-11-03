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

from .helper import get_paged_result
from .audit import audit
from .request_coordination import (
    try_acquire_project_lock,
    wait_for_integrate_request,
)

router = APIRouter(
    prefix="/api/ExportRequest",
    tags=["ExportRequest"],
)


@router.post("/WithJob", response_model=models.ExportRequest)
async def create_export_request_with_job(
    exportRequestName: str = Query(..., max_length=100),
    loomeAssistTenantsID: str = Query(...),
    loomeAssistName: Optional[str] = None,
    projectID: Optional[_INT32_POS] = None,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    """Create an Integrate export job and wait for its request record."""
    upn = auth_info["upn"]
    if projectID is None:
        raise HTTPException(status_code=400, detail="projectID is required")

    print(f"Export request received: project={projectID}, user={upn}", flush=True)

    # Only one export request may be active for a project. Do not hold the
    # lock while calling Integrate or waiting for its database row.
    if not try_acquire_project_lock(db, "Export", projectID, timeout_ms=1000):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An export request is already being processed for this project.",
        )
    active_request = db.query(dbtables.ExportRequest).filter(
        dbtables.ExportRequest.ProjectID == projectID,
        dbtables.ExportRequest.StatusID.in_([-1, 0, 1, 2]),
    ).order_by(
        dbtables.ExportRequest.ExportRequestID.asc(),
    ).first()
    if active_request is not None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An active export request already exists for this project "
                f"(ExportRequestID={active_request.ExportRequestID}, "
                f"StatusID={active_request.StatusID})."
            ),
        )
    db.commit()

    try:
        print(f"Starting export Integrate job: project={projectID}", flush=True)
        token = await asyncio.to_thread(IntegrateLib.get_integrate_bearer_token)
        job = await asyncio.to_thread(
            IntegrateLib.CreateDataExport,
            token, exportRequestName, projectID, loomeAssistTenantsID,
            loomeAssistName, upn,
        )
        if not job or not job.get("jobId"):
            raise RuntimeError("Loome Integrate returned no export job ID")

        db_req = await wait_for_integrate_request(
            db,
            dbtables.ExportRequest,
            job["jobId"],
            projectID,
            upn,
        )
        if db_req is None:
            # Integrate inserts a StatusID=6 row for a duplicate conflict.
            # No row means a genuine job failure, timeout, or persistence
            # failure. Recheck for a concurrent active request before failing.
            if not try_acquire_project_lock(db, "Export", projectID, timeout_ms=1000):
                try:
                    await asyncio.to_thread(
                        IntegrateLib.DeleteIntegrateJob, token, job["jobId"]
                    )
                except Exception as cleanup_error:
                    print(
                        f"Failed to clean up export job after lock timeout: {cleanup_error}",
                        flush=True,
                    )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An export request is already being processed for this project.",
                )
            active_request = db.query(dbtables.ExportRequest).filter(
                dbtables.ExportRequest.ProjectID == projectID,
                dbtables.ExportRequest.StatusID.in_([-1, 0, 1, 2]),
            ).order_by(
                dbtables.ExportRequest.ExportRequestID.asc(),
            ).first()
            db.rollback()
            if active_request is not None:
                try:
                    await asyncio.to_thread(
                        IntegrateLib.DeleteIntegrateJob, token, job["jobId"]
                    )
                except Exception as cleanup_error:
                    print(
                        f"Failed to clean up rejected export job: {cleanup_error}",
                        flush=True,
                    )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "An active export request already exists for this project "
                        f"(ExportRequestID={active_request.ExportRequestID}, "
                        f"StatusID={active_request.StatusID})."
                    ),
                )
            raise RuntimeError(
                "Integrate did not insert the export request record before timeout"
            )

        if db_req.StatusID == 6:
            # The Integrate job has already stopped after recording the
            # duplicate conflict. Preserve the row and do not delete the job.
            conflict_request_id = db_req.ExportRequestID
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An export request already exists for this project. "
                    f"Conflicting ExportRequestID={conflict_request_id}. StatusID=6."
                ),
            )

        db.commit()
        db.refresh(db_req)
        # Integrate may update the row to StatusID=6 between the initial poll
        # and this final refresh. Never pass a conflict row to the response
        # model, whose public status range ends at 5.
        if db_req.StatusID == 6:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An export request already exists for this project. "
                    f"Conflicting ExportRequestID={db_req.ExportRequestID}. StatusID=6."
                ),
            )
        print(f"Export request completed: request={db_req.ExportRequestID}", flush=True)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=f"Failed to create export request job: {exc}",
        ) from exc

    audit(
        event="export_request.create_with_job", action="create",
        result="success", upn=upn, method="POST",
        path="/api/ExportRequest/WithJob", item_type="ExportRequest",
        item_id=db_req.ExportRequestID, status_code=200,
        project_id=db_req.ProjectID, job_id=str(db_req.JobID),
    )
    return _map_export_request(db_req)


def _map_export_request(req: dbtables.ExportRequest) -> models.ExportRequest:
    # Status 6 rows are persisted only as conflict history. They must never be
    # returned as an ExportRequest response.
    if req.StatusID == 6:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate export request ignored; an active export request already exists for this project.",
        )

    return models.ExportRequest(
        ExportRequestID=req.ExportRequestID,
        ExportProjectID=req.ExportProjectID,
        JobID=req.JobID,
        ExportProjectName=req.ExportProjectName,
        ExportRequestName=req.ExportRequestName,
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


def _mark_export_request_if_orphaned(
    req: dbtables.ExportRequest,
    db: Session,
) -> bool:
    """Handle missing projects without overwriting request lifecycle states.

    Conflict requests must remain terminal. A missing generated Export project
    ID is expected briefly while Integrate is provisioning it.

    Export request statuses:
    -2 = failed or orphaned request
    -1 = new request; Integrate job working
     0 = Integrate job complete; awaiting submission
     1 = submitted; awaiting approval
     2 = approved; awaiting finalisation
     3 = finalised
     4 = rejected by an approver
     5 = cancelled/deleted by the requester
     6 = conflict; another non-finalised export request exists
    """
    if req.StatusID == 6:
        return False

    if req.Orphaned is not None:
        return False

    source_projects = db.query(dbtables.LoomeAssistProjects).filter(
        dbtables.LoomeAssistProjects.AssistProjectID == req.ProjectID
    ).all()
    source_missing = not source_projects or any(
        project.IsActive == 0 for project in source_projects
    )

    export_project_missing = False
    if req.ExportProjectID is not None:
        export_projects = db.query(dbtables.LoomeAssistProjects).filter(
            dbtables.LoomeAssistProjects.AssistProjectID == req.ExportProjectID
        ).all()
        export_project_missing = not export_projects or any(
            project.IsActive == 0 for project in export_projects
        )

    if source_missing or export_project_missing:
        req.Orphaned = datetime.now()
        if req.StatusID in (-1, 0):
            req.StatusID = -2
        elif req.StatusID in (1, 2):
            req.StatusID = -2
        return True

    return False


# Get export requests filtered by the authenticated user's UPN (CreateUser)
@router.get("/List", response_model=models.ExportRequestPagedResult)
async def get_export_requests_by_upn(
    page: int = 1,
    pageSize: int = 10,
    search: str = Query(None),
    statusId: int = Query(None),
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    query = db.query(dbtables.ExportRequest).filter(
        dbtables.ExportRequest.CreateUser.contains(upn),
        dbtables.ExportRequest.StatusID.notin_([5, 6])
    )

    if statusId is not None:
        query = query.filter(dbtables.ExportRequest.StatusID == statusId)

    if search:
        lower_search = f"%{search.lower()}%"
        query = query.filter(
            or_(func.lower(dbtables.ExportRequest.ExportRequestName).like(lower_search))
        )

    results = [_map_export_request(req) for req in query.all()]
    return get_paged_result(results, page, pageSize)


# Update the StatusID of an export request
@router.put("/Update/{id}", response_model=models.ExportRequest)
async def update_export_request_status(
    id: _INT32_POS,
    statusID: _STATUS_ID,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    req = db.query(dbtables.ExportRequest).filter(dbtables.ExportRequest.ExportRequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Export request not found")

    req.StatusID = statusID
    db.commit()
    db.refresh(req)
    audit(
        event="export_request.update", action="update", result="success",
        upn=upn, method="PUT", path=f"/api/ExportRequest/Update/{id}",
        item_type="ExportRequest", item_id=id, status_code=200,
    )
    return _map_export_request(req)


# Approve an export request (StatusID=2, set ApprovedDate and ApprovedBy)
@router.post("/{id}/Approve", response_model=models.ExportRequest)
async def approve_export_request(
    id: _INT32_POS,
    reason: str = Query(..., max_length=500),
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    req = db.query(dbtables.ExportRequest).filter(dbtables.ExportRequest.ExportRequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Export request not found")

    if req.StatusID == 6:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Export request conflict records cannot be approved.",
        )

    if _mark_export_request_if_orphaned(req, db):
        db.commit()
        db.refresh(req)
        return _map_export_request(req)

    req.StatusID = 2
    req.ApprovedDate = datetime.now()
    req.ApprovedBy = upn.lower()
    req.ApprovalMessage = reason
    db.commit()
    db.refresh(req)
    audit(
        event="export_request.approve", action="approve", result="success",
        upn=upn, method="POST", path=f"/api/ExportRequest/{id}/Approve",
        item_type="ExportRequest", item_id=id, status_code=200,
        project_id=req.ExportProjectID,
    )
    return _map_export_request(req)


# Reject an export request (StatusID=4, set RejectedDate and RejectedBy)
@router.post("/{id}/Reject", response_model=models.ExportRequest)
async def reject_export_request(
    id: _INT32_POS,
    reason: str = Query(..., max_length=500),
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    req = db.query(dbtables.ExportRequest).filter(dbtables.ExportRequest.ExportRequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Export request not found")

    if req.StatusID == 6:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Export request conflict records cannot be rejected again.",
        )

    if _mark_export_request_if_orphaned(req, db):
        db.commit()
        db.refresh(req)
        return _map_export_request(req)

    req.StatusID = 4
    req.RejectedDate = datetime.now()
    req.RejectedBy = upn.lower()
    req.RejectionMessage = reason
    db.commit()
    db.refresh(req)
    audit(
        event="export_request.reject", action="reject", result="success",
        upn=upn, method="POST", path=f"/api/ExportRequest/{id}/Reject",
        item_type="ExportRequest", item_id=id, status_code=200,
        project_id=req.ExportProjectID,
    )
    return _map_export_request(req)


# Delete an export request (creator only)
@router.put("/{id}/Cancel", response_model=models.ExportRequest)
async def cancel_export_request(
    id: _INT32_POS,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    # Get export request details
    req = db.query(dbtables.ExportRequest).filter(dbtables.ExportRequest.ExportRequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Export request not found")
    
    if upn.lower() != req.CreateUser.lower():
        raise HTTPException(status_code=403, detail="Not authorized to delete this request")

    # Status 6 means Integrate already stopped the duplicate job.
    if req.StatusID != 6:
        try:
            auth_token = IntegrateLib.get_integrate_bearer_token()
            if req.JobID:
                IntegrateLib.DeleteIntegrateJob(auth_token, req.JobID)
        except Exception as e:
            print(f"Error deleting Integrate job with ID {req.JobID}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete associated Integrate job with ID {req.JobID}")
    
    # Delete its Repo and Solution Collection from its Assist Project in Loome Assist
    # Get the Repo ID using the ExportProjectID
    repo_record = db.query(dbtables.LoomeAssistProjectsDataRepos).\
        join(dbtables.LoomeAssistProjects, 
             dbtables.LoomeAssistProjectsDataRepos.LoomeAssistProjectsID == dbtables.LoomeAssistProjects.LoomeAssistProjectsID).\
        join(dbtables.ExportRequest, 
             dbtables.LoomeAssistProjects.AssistProjectID == dbtables.ExportRequest.ExportProjectID).\
        filter(dbtables.ExportRequest.ExportProjectID == req.ExportProjectID).\
        first()
    
    if repo_record is None:
        print(f"No associated Repo found for ExportProjectID {req.ExportProjectID}")
        if req.StatusID not in (-2, -1, 6):
            raise HTTPException(status_code=404, detail=f"No associated Repo found for ExportProjectID {req.ExportProjectID}")
    
    repoID = repo_record.SourceDataRepoID if repo_record else None
   
    if repo_record is not None:
        try:
            auth_token = AssistLib.get_assist_bearer_token()
            if req.ExportProjectID: 
                AssistLib.DeleteResources(auth_token, req.ExportProjectID, repoID, req.SolutionCollectionID)
            # Delete the repo record from database
            db.delete(repo_record)
        except Exception as e:
            print(f"Error deleting Assist resources for Project ID {req.ExportProjectID}, Repo ID {repoID}, Solution Collection ID {req.SolutionCollectionID}: {e}")
            audit(
                event="export_request.cancel", action="cancel", result="failure",
                upn=upn, method="PUT", path=f"/api/ExportRequest/{id}/Cancel",
                item_type="ExportRequest", item_id=id, status_code=500,
                project_id=req.ExportProjectID, error_message=str(e),
            )
            raise HTTPException(status_code=500, detail=f"Failed to delete associated Assist resources for Project ID {req.ExportProjectID}")
    
    # Soft delete: Set StatusID to 5 (cancelled) instead of deleting the record
    # StatusID=5 indicates the export request has been cancelled/deleted
    from datetime import datetime
    req.StatusID = 5
    req.ModifiedDate = datetime.now()
    db.commit()
    db.refresh(req)
    audit(
        event="export_request.cancel", action="cancel", result="success",
        upn=upn, method="PUT", path=f"/api/ExportRequest/{id}/Cancel",
        item_type="ExportRequest", item_id=id, status_code=200,
        project_id=req.ExportProjectID, job_id=str(req.JobID) if req.JobID else None,
    )
    return _map_export_request(req)


# Get a single export request by ID (creator only)
@router.get("/{id}", response_model=models.ExportRequest)
async def get_export_request_by_id(
    id: _INT32_POS,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    req = db.query(dbtables.ExportRequest).filter(dbtables.ExportRequest.ExportRequestID == id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Export request not found")

    if req.StatusID == 6:
        raise HTTPException(status_code=404, detail="Export request not found")

    if not req.CreateUser or upn.lower() != req.CreateUser.lower():
        raise HTTPException(status_code=403, detail="Not authorized to access this request")

    return _map_export_request(req)


# Get all export requests with optional filtering by statusId and search
@router.get("/", response_model=models.ExportRequestPagedResult)
async def get_all_export_requests(
    page: int = 1,
    pageSize: int = 10,
    search: str = Query(None),
    statusId: int = Query(None),
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db),
):
    upn = auth_info["upn"]
    print(f"UPN from headers: {upn}")

    query = db.query(dbtables.ExportRequest)
    query = query.filter(dbtables.ExportRequest.StatusID.notin_([5, 6]))

    if statusId is not None:
        query = query.filter(dbtables.ExportRequest.StatusID == statusId)

    if search:
        lower_search = f"%{search.lower()}%"
        query = query.filter(
            or_(func.lower(dbtables.ExportRequest.ExportRequestName).like(lower_search))
        )

    results = [_map_export_request(req) for req in query.all()]
    return get_paged_result(results, page, pageSize)
