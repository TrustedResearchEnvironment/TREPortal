from fastapi import FastAPI, Depends, Request
from sqlalchemy.orm import Session
from fastapi import FastAPI, Security, HTTPException, status
from fastapi.security import APIKeyHeader


import time
import logging
from sqlalchemy.exc import OperationalError
from database import engine
import os
from fastapi import BackgroundTasks
from app import VerifyHeaders



_EXPECTED_API_KEY = os.getenv("API_KEY")
_api_key_header = APIKeyHeader(name="X-API-Key", scheme_name="ApiKeyAuth", auto_error=False, description="API Key needed to access the endpoints")
_upn_header = APIKeyHeader(name="X-UPN", scheme_name="UpnHeader", auto_error=False, description="User Principal Name of the caller, e.g., user@example.com ")


# _api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
# _upn_header = APIKeyHeader(name="X-UPN", auto_error=False)

def verify_headers(
    upn: str = Security(_upn_header),
    api_key: str = Security(_api_key_header)
) -> dict:
 
    # upn_display = f"{upn[:4]}...{upn[-4:]}" if upn and len(upn) > 8 else upn
    print("Verify_headers called with upn:", upn, "api_key length:", len(api_key) if api_key else 0)
    if not api_key or api_key != _EXPECTED_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing API key")
    if not upn:
        # if api key is testing key set upn to testing upn
        if api_key == _EXPECTED_API_KEY:
            upn = "testing.upn@example.com"
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing UPN header")
    return { "upn": upn, "api_key": api_key,}