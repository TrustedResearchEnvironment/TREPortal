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



# _EXPECTED_API_KEY = "UI8MVNwYj5hbjU5fD0pWjdzS1NBKjVHSTV9bTN0Q0hIJUxcZnpbRn1sPlBPYnFVdSFRY3deP0xmMGdSc2FsUDVvVl"  # e.g., get_secret_from_vault("API-KEY")
_EXPECTED_API_KEY = os.getenv("API_KEY")
print("Expected API Key:", _EXPECTED_API_KEY[:4] + "..." + _EXPECTED_API_KEY[-4:] if _EXPECTED_API_KEY else "Not Set")
_api_key_header = APIKeyHeader(name="X-API-Key", scheme_name="ApiKeyAuth", auto_error=False, description="API Key needed to access the endpoints")
_upn_header = APIKeyHeader(name="X-UPN", scheme_name="UpnHeader", auto_error=False, description="User Principal Name of the caller, e.g., user@example.com ")


# _api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
# _upn_header = APIKeyHeader(name="X-UPN", auto_error=False)

def verify_headers(
    upn: str = Security(_upn_header),
    api_key: str = Security(_api_key_header)
) -> dict:
 
    # upn_display = f"{upn[:4]}...{upn[-4:]}" if upn and len(upn) > 8 else upn
    api_key_display = f"{api_key[:4]}...{api_key[-4:]}" if api_key and len(api_key) > 8 else api_key
    print("Verify_headers called with upn:", upn, "and api_key:", api_key_display , "(", len(api_key),")")
    if not api_key or api_key != _EXPECTED_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing API key")
    if not upn:
        # if api key is testing key set upn to testing upn
        if api_key == _EXPECTED_API_KEY:
            upn = "testing.upn@example.com"
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing UPN header")
    return { "upn": upn, "api_key": api_key,}