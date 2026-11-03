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

from .helper  import get_paged_result



router = APIRouter(
    prefix="/api/IngestionLog",
    tags=["IngestionLog"],
)

# Return the Ingestion Log by RequestID
@router.get("/GetIngestionLogByRequestID/{request_id}", response_model=List[models.IngestionLog])
async def get_ingestion_log_by_request_id(
    request_id: _INT32_POS,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    try:
        ingestion_logs = db.query(dbtables.IngestionLog).filter(dbtables.IngestionLog.RequestID == request_id).all()
        return ingestion_logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))