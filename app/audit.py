import json
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request, Response
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware


# ── Audit log schema (flat) ──────────────────────────────────────────────────

class AuditLog(BaseModel):
    timestamp: str
    level: str = "AUDIT"
    event: str
    trace_id: str
    upn: Optional[str] = None
    ip_address: Optional[str] = None
    method: str
    path: str
    status_code: Optional[int] = None
    duration_ms: Optional[float] = None
    item_type: Optional[str] = None
    item_id: Optional[str] = None
    action: Optional[str] = None
    result: Optional[str] = None
    project_id: Optional[int] = None
    job_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


def emit_audit(log: AuditLog):
    """Print flat JSON to stdout — picked up by Azure Log Analytics."""
    print(json.dumps(log.model_dump()), flush=True)


def audit(
    event: str,
    action: str,
    result: str,
    upn: Optional[str],
    method: str,
    path: str,
    item_type: Optional[str] = None,
    item_id: Optional[int] = None,
    status_code: Optional[int] = None,
    project_id: Optional[int] = None,
    job_id: Optional[str] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    ip_address: Optional[str] = None,
    trace_id: Optional[str] = None,
):
    """
    Emit a domain audit log entry from within an endpoint handler.

    Usage:
        audit(
            event="export_request.cancel",
            action="cancel",
            result="success",
            upn=upn,
            method="PUT",
            path=f"/api/ExportRequest/{id}/Cancel",
            item_type="ExportRequest",
            item_id=req.ExportRequestID,
            status_code=200,
            project_id=req.ExportProjectID,
            job_id=str(req.JobID),
        )
    """
    log = AuditLog(
        timestamp=datetime.now(timezone.utc).isoformat(),
        event=event,
        trace_id=trace_id or str(uuid.uuid4()),
        upn=upn,
        ip_address=ip_address,
        method=method,
        path=path,
        status_code=status_code,
        item_type=item_type,
        item_id=str(item_id) if item_id is not None else None,
        action=action,
        result=result,
        project_id=project_id,
        job_id=job_id,
        error_code=error_code,
        error_message=error_message,
    )
    emit_audit(log)


# ── Middleware: auto-audit every HTTP request/response ───────────────────────

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        trace_id = str(uuid.uuid4())
        request.state.trace_id = trace_id
        start = time.perf_counter()

        response: Response = await call_next(request)

        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        # upn is set on request.state by VerifyHeaders dependency;
        # middleware runs before dependencies so it may be None here —
        # per-endpoint audit() calls will have the correct value.
        upn = getattr(request.state, "upn", None)

        log = AuditLog(
            timestamp=datetime.now(timezone.utc).isoformat(),
            event="http.request",
            trace_id=trace_id,
            upn=upn,
            ip_address=request.client.host if request.client else None,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            result="success" if response.status_code < 400 else "failure",
        )
        emit_audit(log)
        return response
