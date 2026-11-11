import os
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader, HTTPBearer


_EXPECTED_API_KEY = os.getenv("API_KEY")
_api_key_header = APIKeyHeader(name="X-API-Key", scheme_name="ApiKeyAuth", auto_error=False, description="API Key needed to access the endpoints")
_bearer = HTTPBearer(scheme_name="EntraBearer", auto_error=False, description="Microsoft Entra ID access token. Required on every endpoint except /api/health.")

_HEALTH_PATH = "/api/health"
_REQUIRED_SCOPE = "access_as_user"


@lru_cache(maxsize=4)
def _jwks_client(tenant_id: str) -> PyJWKClient:
    return PyJWKClient(f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys")


def _upn_from_token(token: str) -> str:
    tenant_id = os.getenv("ENTRA_TENANT_ID")
    client_id = os.getenv("ENTRA_CLIENT_ID")
    if not tenant_id or not client_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Entra ID is not configured")

    try:
        signing_key = _jwks_client(tenant_id).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=[client_id, f"api://{client_id}"],
            issuer=f"https://login.microsoftonline.com/{tenant_id}/v2.0",
            options={"require": ["exp", "iss", "aud"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if _REQUIRED_SCOPE not in str(claims.get("scp", "")).split():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token is missing the required scope")

    upn = claims.get("preferred_username") or claims.get("upn")
    if not upn:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has no user name claim")
    return upn


def verify_headers(
    request: Request,
    api_key: str = Security(_api_key_header),
    bearer=Security(_bearer),
) -> dict:
    if not api_key or api_key != _EXPECTED_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing API key")

    if request.url.path == _HEALTH_PATH:
        upn = "healthcheck"
    elif bearer:
        upn = _upn_from_token(bearer.credentials)
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    request.state.upn = upn
    return {"upn": upn, "api_key": api_key}
