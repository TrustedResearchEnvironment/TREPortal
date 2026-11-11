import time
import types

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from starlette.requests import Request

from app import VerifyHeaders

API_KEY = "test-api-key"
TENANT_ID = "test-tenant"
CLIENT_ID = "test-client"


@pytest.fixture(scope="module")
def private_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def entra_settings(monkeypatch, private_key):
    monkeypatch.setattr(VerifyHeaders, "_EXPECTED_API_KEY", API_KEY)
    monkeypatch.setenv("ENTRA_TENANT_ID", TENANT_ID)
    monkeypatch.setenv("ENTRA_CLIENT_ID", CLIENT_ID)
    jwks = types.SimpleNamespace(
        get_signing_key_from_jwt=lambda token: types.SimpleNamespace(key=private_key.public_key())
    )
    monkeypatch.setattr(VerifyHeaders, "_jwks_client", lambda tenant_id: jwks)


def make_token(private_key, **overrides):
    claims = {
        "iss": f"https://login.microsoftonline.com/{TENANT_ID}/v2.0",
        "aud": CLIENT_ID,
        "exp": int(time.time()) + 300,
        "scp": "access_as_user",
        "preferred_username": "researcher@example.com",
    }
    claims.update(overrides)
    claims = {key: value for key, value in claims.items() if value is not None}
    return jwt.encode(claims, private_key, algorithm="RS256")


def verify(path="/api/Request/List", token=None, api_key=API_KEY):
    request = Request({"type": "http", "method": "GET", "path": path, "headers": []})
    bearer = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token) if token else None
    return VerifyHeaders.verify_headers(request=request, api_key=api_key, bearer=bearer)


def test_valid_token_sets_upn(private_key):
    assert verify(token=make_token(private_key))["upn"] == "researcher@example.com"


def test_api_audience_form_is_accepted(private_key):
    assert verify(token=make_token(private_key, aud=f"api://{CLIENT_ID}"))["upn"] == "researcher@example.com"


def test_upn_claim_is_used_when_preferred_username_is_absent(private_key):
    token = make_token(private_key, preferred_username=None, upn="alias@example.com")
    assert verify(token=token)["upn"] == "alias@example.com"


@pytest.mark.parametrize(
    "overrides",
    [
        {"exp": int(time.time()) - 10},
        {"aud": "another-client"},
        {"iss": "https://login.microsoftonline.com/another-tenant/v2.0"},
        {"preferred_username": None},
    ],
    ids=["expired", "wrong-audience", "wrong-issuer", "no-user-claim"],
)
def test_invalid_token_is_rejected(private_key, overrides):
    with pytest.raises(HTTPException) as error:
        verify(token=make_token(private_key, **overrides))
    assert error.value.status_code == 401


def test_token_without_scope_is_forbidden(private_key):
    with pytest.raises(HTTPException) as error:
        verify(token=make_token(private_key, scp="other_scope"))
    assert error.value.status_code == 403


def test_garbage_token_is_rejected():
    with pytest.raises(HTTPException) as error:
        verify(token="not-a-jwt")
    assert error.value.status_code == 401


def test_wrong_api_key_is_forbidden(private_key):
    with pytest.raises(HTTPException) as error:
        verify(token=make_token(private_key), api_key="wrong")
    assert error.value.status_code == 403


def test_a_token_is_always_required():
    with pytest.raises(HTTPException) as error:
        verify()
    assert error.value.status_code == 401


def test_missing_entra_settings_fail_closed(private_key, monkeypatch):
    monkeypatch.delenv("ENTRA_TENANT_ID")
    monkeypatch.delenv("ENTRA_CLIENT_ID")
    with pytest.raises(HTTPException) as error:
        verify(token=make_token(private_key))
    assert error.value.status_code == 500


def test_health_needs_no_token():
    assert verify(path="/api/health")["upn"] == "healthcheck"


@pytest.fixture
def real_auth_client(client: TestClient):
    from main import app

    app.dependency_overrides.pop(VerifyHeaders.verify_headers)
    return client


def test_api_rejects_request_without_token(real_auth_client: TestClient):
    response = real_auth_client.get("/api/Request/List")
    assert response.status_code == 401


def test_api_ignores_x_upn_header(real_auth_client: TestClient):
    response = real_auth_client.get("/api/Request/List", headers={"X-UPN": "spoofed@example.com"})
    assert response.status_code == 401


def test_api_health_needs_no_token(real_auth_client: TestClient):
    assert real_auth_client.get("/api/health").status_code == 200
