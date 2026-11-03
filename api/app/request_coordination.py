"""Database-backed coordination for request workflows."""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session


ACTIVE_REQUEST_STATUSES = (-1, 0, 1, 2)


def get_active_import_request(db: Session, project_id: int):
    """Return the earliest active import request for an origin project."""
    from . import dbtables

    return db.query(dbtables.ImportRequest).filter(
        dbtables.ImportRequest.ProjectID == project_id,
        dbtables.ImportRequest.StatusID.in_(ACTIVE_REQUEST_STATUSES),
    ).order_by(
        dbtables.ImportRequest.ImportRequestID.asc(),
    ).first()


async def wait_for_integrate_request(
    db: Session,
    request_model,
    job_id: int,
    project_id: int,
    upn: str,
):
    """Wait for an Integrate script to insert its request row.

    The Integrate PowerShell scripts create the request record themselves and
    use the Integrate job ID as the correlation key.
    """
    # Keep the default below the upstream 30-second HttpClient timeout. This
    # endpoint should fail fast rather than leave callers waiting indefinitely.
    timeout_seconds = float(os.getenv("INTEGRATE_REQUEST_POLL_TIMEOUT", "20"))
    interval_seconds = float(os.getenv("INTEGRATE_REQUEST_POLL_INTERVAL", "1"))
    deadline = asyncio.get_running_loop().time() + timeout_seconds

    while asyncio.get_running_loop().time() < deadline:
        request_id_column = (
            request_model.ExportRequestID
            if hasattr(request_model, "ExportRequestID")
            else request_model.ImportRequestID
        )
        request = db.query(request_model).filter(
            request_model.JobID == job_id,
            request_model.ProjectID == project_id,
            request_model.CreateUser.ilike(upn),
        ).order_by(
            request_model.CreateDate.desc(),
            request_id_column.desc(),
        ).first()
        if request is not None:
            return request
        await asyncio.sleep(interval_seconds)

    return None


def acquire_project_lock(db: Session, request_type: str, project_id: int) -> None:
    """Create, then exclusively coordinate on, a project lock row.

    The caller must keep the SQLAlchemy transaction open until its coordinated
    database work has completed.
    """
    if request_type not in {"Export", "Import"}:
        raise ValueError(f"Unsupported request type: {request_type}")

    # HOLDLOCK makes the check-and-insert serializable for this key. The
    # subsequent UPDLOCK is held until the surrounding transaction ends.
    db.execute(
        text("""
            MERGE dbo.RequestProjectLock WITH (HOLDLOCK) AS target
            USING (VALUES (:request_type, :project_id))
                AS source (RequestType, ProjectID)
            ON target.RequestType = source.RequestType
               AND target.ProjectID = source.ProjectID
            WHEN NOT MATCHED THEN
                INSERT (RequestType, ProjectID)
                VALUES (source.RequestType, source.ProjectID);
        """),
        {"request_type": request_type, "project_id": project_id},
    )

    db.execute(
        text("""
            SELECT RequestType, ProjectID
            FROM dbo.RequestProjectLock WITH (UPDLOCK, HOLDLOCK)
            WHERE RequestType = :request_type
              AND ProjectID = :project_id;
        """),
        {"request_type": request_type, "project_id": project_id},
    ).one()


def try_acquire_project_lock(
    db: Session,
    request_type: str,
    project_id: int,
    timeout_ms: int = 1000,
) -> bool:
    """Try to acquire a project lock without waiting behind a long workflow."""
    try:
        db.execute(text(f"SET LOCK_TIMEOUT {int(timeout_ms)}"))
        acquire_project_lock(db, request_type, project_id)
        db.execute(text("SET LOCK_TIMEOUT -1"))
        return True
    except OperationalError:
        db.rollback()
        return False
