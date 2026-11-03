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
from .helper import get_paged_result
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID

from PortalLib import IntegrateLib 

class ProjectMembership(BaseModel):
    """Project membership model."""
    # Add fields as needed when structure is known
    pass

class LastExecution(BaseModel):
    """Last execution details model."""
    project_id: int = Field(alias="projectId")
    job_execution_id: int = Field(alias="jobExecutionId") 
    job_id: int = Field(alias="jobId")
    execution_guid: Optional[str] = Field(alias="executionGuid", default=None)  # Changed from UUID to str
    start_time: str = Field(alias="startTime")  # Changed from datetime to str
    # end_time: str = Field(alias="endTime")  # Changed from datetime to str
    end_time: Optional[str] = Field(alias="endTime", default=None) #MIGUEL
    status: str = Field(alias="status")
    partition_id: int = Field(alias="partitionId")
    job_name: str = Field(alias="jobName")
    project_memberships: List[ProjectMembership] = Field(alias="projectMemberships", default=[])
    project_api_memberships: Optional[List] = Field(alias="projectApiMemberships", default=None)

    model_config = ConfigDict(populate_by_name=True)

class Schedule(BaseModel):
    """Schedule details model."""
    has_schedules: bool = Field(alias="hasSchedules")
    has_enabled_schedules: bool = Field(alias="hasEnabledSchedules") 
    object_id: int = Field(alias="ObjectId")
    next_execution_date: Optional[str] = Field(alias="nextExecutionDate", default=None)  # Changed from datetime to str

    model_config = ConfigDict(populate_by_name=True)

class DataImportJob(BaseModel):
    """Data import job model."""
    job_id: int = Field(alias="jobId")
    project_id: int = Field(alias="projectId")
    date_created: str = Field(alias="dateCreated")  # Changed from datetime to str
    date_modified: str = Field(alias="dateModified")  # Changed from datetime to str
    created_by: str = Field(alias="createdBy")
    modified_by: str = Field(alias="modifiedBy")
    job_name: str = Field(alias="jobName")
    logging: int = Field(alias="logging")
    log_batch_size: int = Field(alias="logBatchSize")
    agent_job_id: str = Field(alias="agentJobId")  # Changed from UUID to str
    email_notification_recipients: str = Field(alias="emailNotificationRecipients")
    email_notification_rule_id: int = Field(alias="emailNotificationRuleId")
    cancel_job_flag: bool = Field(alias="cancelJobFlag")
    logging_type: Optional[str] = Field(alias="loggingType", default=None)
    status: Optional[str] = Field(alias="status", default=None)
    last_execution: Optional[LastExecution] = Field(alias="lastExecution", default=None)  # Made optional
    schedule: Schedule = Field(alias="schedule")
    retry_count: Optional[int] = Field(alias="retryCount", default=None)

    model_config = ConfigDict(populate_by_name=True)

# Response models for create_data_import (single job creation)
class ProjectDetails(BaseModel):
    """Project details model for created job."""
    project_id: int = Field(alias="projectId")
    project_name: str = Field(alias="projectName")
    requires_sync: bool = Field(alias="requiresSync")
    project_memberships: Optional[List] = Field(alias="projectMemberships", default=None)
    project_membership_invites: Optional[List] = Field(alias="projectMembershipInvites", default=None)
    tasks: Optional[List] = Field(alias="tasks", default=None)

    model_config = ConfigDict(populate_by_name=True)

class DataImportJobCreated(BaseModel):
    """Data import job creation response model."""
    job_id: int = Field(alias="jobId")
    project_id: int = Field(alias="projectId")
    job_name: str = Field(alias="jobName")
    logging: int = Field(alias="logging")
    email_notification_recipients: str = Field(alias="emailNotificationRecipients")
    email_notification_rule_id: int = Field(alias="emailNotificationRuleId")
    cancel_job_flag: bool = Field(alias="cancelJobFlag")
    log_batch_size: int = Field(alias="logBatchSize")
    retry_count: Optional[int] = Field(alias="retryCount", default=None)
    job_dependency_predecessor_job: List = Field(alias="jobDependencyPredecessorJob", default=[])
    job_dependency_job: List = Field(alias="jobDependencyJob", default=[])
    job_sequence: List = Field(alias="jobSequence", default=[])
    schedules: Optional[List] = Field(alias="schedules", default=None)
    email_notification_rule: Optional[dict] = Field(alias="emailNotificationRule", default=None)
    job_executions: List = Field(alias="jobExecutions", default=[])
    logging_type: Optional[str] = Field(alias="loggingType", default=None)
    task_queues: List = Field(alias="taskQueues", default=[])
    project: ProjectDetails = Field(alias="project")
    last_execution: Optional[LastExecution] = Field(alias="lastExecution", default=None)
    created_by: str = Field(alias="createdBy")
    modified_by: str = Field(alias="modifiedBy")
    date_created: str = Field(alias="dateCreated")  # Changed from datetime to str
    date_modified: str = Field(alias="dateModified")  # Changed from datetime to str

    model_config = ConfigDict(populate_by_name=True)

class DataImportPagedResult(BaseModel):
    """Paged result model for data imports."""
    current_page: int = Field(alias="CurrentPage")
    page_count: int = Field(alias="PageCount")
    page_size: int = Field(alias="PageSize") 
    row_count: int = Field(alias="RowCount")
    first_row_on_page: int = Field(alias="FirstRowOnPage")
    last_row_on_page: int = Field(alias="LastRowOnPage")
    results: List[DataImportJob] = Field(alias="Results")

    model_config = ConfigDict(populate_by_name=True)

router = APIRouter(
    prefix="/api/DataImport",
    tags=["DataImport"],
)

@router.get("", response_model=DataImportPagedResult)
async def get_all_dataimports(
    page: int = 1,
    pageSize: int = 5,
    search: str = Query(None),
    auth_info: dict = Depends(verify_headers),
):
    """
    Get all data imports with pagination using existing helper method.
    """
    print("Fetching all data imports...")
    _upn = auth_info.get("upn")
    if not _upn:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="UPN not found in auth info")
    
    _token = IntegrateLib.get_integrate_bearer_token()

    # GetAllImportJobs
    _jobs = IntegrateLib.GetAllImportJobs(_token, _upn)
    print(f"Total jobs fetched: {len(_jobs)}")
    
    # Apply search filter if provided
    if search:
        print(f"Applying search filter: {search}")
        _jobs = [job for job in _jobs if search.lower() in job.get("jobName", "").lower()]
    
    _paged_results = get_paged_result(_jobs, page, pageSize)
    
    # Since _paged_results already has the correct structure, return it directly
    print(f"DEBUG: _paged_results structure: {_paged_results}")
    return _paged_results


@router.post("/ApprovedDataTransfer/{ImportRequestID}", response_model=DataImportJobCreated)
async def approve_data_import(
    ImportRequestID: _INT32_POS,
    auth_info: dict = Depends(verify_headers),
):
    """
    Approve a data import job.
    """ 
    _upn = auth_info.get("upn")
    if not _upn:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="UPN not found in auth info")
    
    _token = IntegrateLib.get_integrate_bearer_token()
    _import_job = IntegrateLib.CreateDataApproveImport(_token, ImportRequestID, _upn)  
    print(_import_job)  
    
    # Return the job creation response directly
    # The response already matches the DataImportJobCreated model structure
    return _import_job

# Legacy split request/job endpoint disabled.
# Use POST /api/ImportRequest/WithJob instead so request creation, superseding,
# external job creation, and JobID persistence occur in one transaction.
# @router.post("/{LoomeAssistProjectID}", response_model=DataImportJobCreated)
async def create_data_import(
    LoomeAssistProjectID: _INT32_POS,
    ImportRequestName: str = Query(..., max_length=100),
    LoomeAssistTenantsID: str = Query(...),
    LoomeAssistName: Optional[str] = None,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="This legacy endpoint is disabled. Use POST /api/ImportRequest/WithJob.",
    )

    """
    Create a new data import job.
    """ 
    _upn = auth_info.get("upn")
    if not _upn:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="UPN not found in auth info")
    
    try:
        acquire_project_lock(db, "Import", LoomeAssistProjectID)

        current_request = db.query(dbtables.ImportRequest).filter(
            dbtables.ImportRequest.ProjectID == LoomeAssistProjectID,
            dbtables.ImportRequest.CreateUser == _upn.lower(),
            dbtables.ImportRequest.ImportRequestName == ImportRequestName,
            dbtables.ImportRequest.StatusID.in_([-1, 0, 1, 2]),
        ).order_by(dbtables.ImportRequest.ImportRequestID.desc()).first()
        if current_request is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import request not found for the specified project",
            )

        current_request_id = current_request.ImportRequestID
        newer_request_exists = db.query(dbtables.ImportRequest).filter(
            dbtables.ImportRequest.ProjectID == LoomeAssistProjectID,
            dbtables.ImportRequest.ImportRequestID > current_request_id,
            dbtables.ImportRequest.CreateUser == _upn.lower(),
            dbtables.ImportRequest.StatusID.in_([-1, 0, 1, 2]),
        ).first() is not None
        if newer_request_exists:
            current_request.StatusID = -3
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Import request was superseded by a newer request",
            )

        superseded_reqs = db.query(dbtables.ImportRequest).filter(
            dbtables.ImportRequest.ProjectID == LoomeAssistProjectID,
            # Request IDs are database-generated and provide the ordering
            # needed for latest-request-wins if job calls arrive out of order.
            dbtables.ImportRequest.ImportRequestID < current_request_id,
            dbtables.ImportRequest.StatusID.in_([-1, 0, 1, 2]),
        ).all()

        auth_token = IntegrateLib.get_integrate_bearer_token()
        for old_request in superseded_reqs:
            if old_request.JobID and old_request.StatusID == -1:
                IntegrateLib.DeleteIntegrateJob(auth_token, old_request.JobID)
            old_request.StatusID = -3

        _token = auth_token
        _import_job = IntegrateLib.CreateDataImport(_token, ImportRequestName, LoomeAssistProjectID, LoomeAssistTenantsID, LoomeAssistName, _upn)
        if not _import_job or not _import_job.get("jobId"):
            raise RuntimeError("Loome Integrate returned no import job ID")

        current_request.JobID = _import_job["jobId"]
        db.commit()
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to create external import job: {e}")
    print(_import_job)  
    
    # Return the job creation response directly
    # The response already matches the DataImportJobCreated model structure
    return _import_job