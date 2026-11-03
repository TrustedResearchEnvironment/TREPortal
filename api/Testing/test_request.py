"""
Test suite for Request Workflow API endpoints.

This module tests the request lifecycle endpoints in app/request.py:
1. GET /api/Request/ - List requests by UPN (CreateUser)
2. GET /api/Request/List - List approval requests by UPN (Approvers)
3. GET /api/Request/All - Admin view of all requests
4. GET /api/Request/{id} - Get single request with authorization
5. POST /api/Request/{id}/Approve - Approve a request
6. POST /api/Request/{id}/Reject - Reject a request
7. DELETE /api/Request/{id}/Delete - Delete a request (CreateUser only)

Test Coverage:
- UPN-based filtering for request lists
- Authorization checks (403 for unauthorized users)
- State machine transitions (Pending -> Approved, Pending -> Rejected)
- Delete authorization (only CreateUser can delete)
- 404 for non-existent requests
- Search filtering and pagination
"""
import pytest
from fastapi.testclient import TestClient
from app.dbtables import Request
from datetime import datetime


# =============================================================================
# Seed Helpers
# =============================================================================

def _seed_request(db_session, **overrides) -> Request:
    """Creates a Request row with sensible defaults, returning the ORM object."""
    defaults = dict(
        Name="Test Request",
        Purpose="Testing",
        StatusID=1,
        ProjectID=100,
        DataSetID=200,
        Approvers="approver@example.com",
        CreateUser="test.user@example.com",
        CreateDate=datetime(2026, 1, 1),
        ModifiedDate=datetime(2026, 1, 1),
    )
    defaults.update(overrides)
    req = Request(**defaults)
    db_session.add(req)
    db_session.flush()
    return req


# =============================================================================
# GET /api/Request/ – My requests (filtered by CreateUser contains UPN)
# =============================================================================


def test_get_my_requests_returns_only_own(client: TestClient, db_session):
    """Only requests whose CreateUser contains the caller's UPN are returned."""
    own = _seed_request(db_session, Name="My Request", CreateUser="test.user@example.com", StatusID=1)
    other = _seed_request(db_session, Name="Other Request", CreateUser="other.user@example.com", StatusID=1)
    db_session.commit()

    response = client.get("/api/Request/", params={"statusId": 1, "pageSize": 100})
    assert response.status_code == 200

    data = response.json()
    names = [r["Name"] for r in data["Results"]]
    assert "My Request" in names
    assert "Other Request" not in names


def test_get_my_requests_filters_by_status(client: TestClient, db_session):
    """The statusId filter is respected."""
    _seed_request(db_session, Name="Pending Req", CreateUser="test.user@example.com", StatusID=1)
    _seed_request(db_session, Name="Approved Req", CreateUser="test.user@example.com", StatusID=2)
    db_session.commit()

    resp = client.get("/api/Request/", params={"statusId": 2, "pageSize": 100})
    assert resp.status_code == 200

    names = [r["Name"] for r in resp.json()["Results"]]
    assert "Approved Req" in names
    assert "Pending Req" not in names


def test_get_my_requests_search(client: TestClient, db_session):
    """The search param filters by Name (case-insensitive)."""
    _seed_request(db_session, Name="Alpha Request", CreateUser="test.user@example.com")
    _seed_request(db_session, Name="Beta Request", CreateUser="test.user@example.com")
    db_session.commit()

    resp = client.get("/api/Request/", params={"search": "alpha", "pageSize": 100})
    assert resp.status_code == 200

    names = [r["Name"] for r in resp.json()["Results"]]
    assert "Alpha Request" in names
    assert "Beta Request" not in names


# =============================================================================
# GET /api/Request/List – Approval list (filtered by Approvers contains UPN)
# =============================================================================


def test_get_approval_list_returns_approver_requests(client: TestClient, db_session):
    """Only requests where the caller is in Approvers are returned."""
    for_me = _seed_request(db_session, Name="For Me", Approvers="test.user@example.com")
    not_mine = _seed_request(db_session, Name="Not Mine", Approvers="someone.else@example.com")
    db_session.commit()

    resp = client.get("/api/Request/List", params={"statusId": 1, "pageSize": 100})
    assert resp.status_code == 200

    names = [r["Name"] for r in resp.json()["Results"]]
    assert "For Me" in names
    assert "Not Mine" not in names


# =============================================================================
# GET /api/Request/All – Admin view (no UPN filter)
# =============================================================================


def test_get_all_requests_no_upn_filter(client: TestClient, db_session):
    """Admin view returns requests regardless of UPN."""
    _seed_request(db_session, Name="Req A", CreateUser="alice@example.com")
    _seed_request(db_session, Name="Req B", CreateUser="bob@example.com")
    db_session.commit()

    resp = client.get("/api/Request/All", params={"statusId": 1, "pageSize": 100})
    assert resp.status_code == 200

    names = [r["Name"] for r in resp.json()["Results"]]
    assert "Req A" in names
    assert "Req B" in names


# =============================================================================
# GET /api/Request/{id} – Single request + Authorization
# =============================================================================


def test_get_request_by_id_as_creator(client: TestClient, db_session):
    """Creator can view their own request."""
    req = _seed_request(db_session, CreateUser="test.user@example.com", Approvers="approver@example.com")
    db_session.commit()

    resp = client.get(f"/api/Request/{req.RequestID}")
    assert resp.status_code == 200
    assert resp.json()["RequestID"] == req.RequestID


def test_get_request_by_id_as_approver(client: TestClient, db_session):
    """Approver can view the request."""
    req = _seed_request(db_session, CreateUser="other@example.com", Approvers="test.user@example.com")
    db_session.commit()

    resp = client.get(f"/api/Request/{req.RequestID}")
    assert resp.status_code == 200
    assert resp.json()["RequestID"] == req.RequestID


def test_get_request_by_id_unauthorized(client: TestClient, db_session):
    """A user not in Approvers/CreateUser/CurrentlyApproved gets 403."""
    req = _seed_request(
        db_session,
        CreateUser="other@example.com",
        Approvers="someone.else@example.com",
        CurrentlyApproved=None,
    )
    db_session.commit()

    resp = client.get(f"/api/Request/{req.RequestID}")
    assert resp.status_code == 403


def test_get_request_by_id_not_found(client: TestClient, db_session):
    """Non-existent request returns 404."""
    resp = client.get("/api/Request/999999")
    assert resp.status_code == 404


# =============================================================================
# POST /api/Request/{id}/Approve
# =============================================================================


def test_approve_request_success(client: TestClient, db_session):
    """Approver can approve a pending request; status becomes 2."""
    req = _seed_request(db_session, Approvers="test.user@example.com", StatusID=1)
    db_session.commit()

    resp = client.post(
        f"/api/Request/{req.RequestID}/Approve",
        params={"reason": "Looks good"},
    )
    assert resp.status_code == 200

    body = resp.json()
    assert body["StatusID"] == 2
    assert body["ApprovalMessage"] == "Looks good"
    assert body["CurrentlyApproved"] == "test.user@example.com"
    assert body["ApprovedDate"] is not None


def test_approve_request_unauthorized(client: TestClient, db_session):
    """Non-approver cannot approve."""
    req = _seed_request(db_session, Approvers="someone.else@example.com", StatusID=1)
    db_session.commit()

    resp = client.post(
        f"/api/Request/{req.RequestID}/Approve",
        params={"reason": "Should fail"},
    )
    assert resp.status_code == 403


def test_approve_request_not_found(client: TestClient, db_session):
    """Approving a non-existent request returns 404."""
    resp = client.post("/api/Request/999999/Approve", params={"reason": "nope"})
    assert resp.status_code == 404


# =============================================================================
# POST /api/Request/{id}/Reject
# =============================================================================


def test_reject_request_success(client: TestClient, db_session):
    """Approver can reject a pending request; status becomes 4."""
    req = _seed_request(db_session, Approvers="test.user@example.com", StatusID=1)
    db_session.commit()

    resp = client.post(
        f"/api/Request/{req.RequestID}/Reject",
        params={"reason": "Not justified"},
    )
    assert resp.status_code == 200

    body = resp.json()
    assert body["StatusID"] == 4
    assert body["RejectionMessage"] == "Not justified"
    assert body["RejectedBy"] == "test.user@example.com"
    assert body["RejectedDate"] is not None


def test_reject_request_unauthorized(client: TestClient, db_session):
    """Non-approver cannot reject."""
    req = _seed_request(db_session, Approvers="someone.else@example.com", StatusID=1)
    db_session.commit()

    resp = client.post(
        f"/api/Request/{req.RequestID}/Reject",
        params={"reason": "Should fail"},
    )
    assert resp.status_code == 403


# =============================================================================
# DELETE /api/Request/{id}/Delete
# =============================================================================


def test_delete_request_as_creator(client: TestClient, db_session):
    """Creator can delete their own request."""
    req = _seed_request(db_session, CreateUser="test.user@example.com")
    db_session.commit()

    resp = client.delete(f"/api/Request/{req.RequestID}/Delete")
    assert resp.status_code == 200

    # Confirm it's gone
    verify = client.get(f"/api/Request/{req.RequestID}")
    assert verify.status_code == 404


def test_delete_request_unauthorized(client: TestClient, db_session):
    """A non-creator cannot delete the request."""
    req = _seed_request(db_session, CreateUser="someone.else@example.com")
    db_session.commit()

    resp = client.delete(f"/api/Request/{req.RequestID}/Delete")
    assert resp.status_code == 403


def test_delete_request_not_found(client: TestClient, db_session):
    """Deleting a non-existent request returns 404."""
    resp = client.delete("/api/Request/999999/Delete")
    assert resp.status_code == 404


# =============================================================================
# SQL Injection Handling
# =============================================================================
# These assert that SQL-injection-style payloads passed via query params/search
# are treated as inert bound parameters and never alter query structure.

def test_get_my_requests_search_handles_sql_injection_payload(client: TestClient, db_session):
    """A malicious search term must not error out or match unrelated rows."""
    _seed_request(db_session, Name="Alpha Request", CreateUser="test.user@example.com")
    db_session.commit()

    resp = client.get("/api/Request/", params={
        "statusId": 1,
        "pageSize": 100,
        "search": "'; DROP TABLE dbo.Request;--",
    })
    assert resp.status_code == 200
    assert resp.json()["Results"] == []

    # Confirm the table survived and is still queryable.
    follow_up = client.get("/api/Request/", params={"statusId": 1, "pageSize": 100})
    assert follow_up.status_code == 200
    assert any(r["Name"] == "Alpha Request" for r in follow_up.json()["Results"])


def test_approve_request_stores_sql_injection_payload_literally(client: TestClient, db_session):
    """Injection payloads in the 'reason' field are stored as plain text, not executed."""
    req = _seed_request(db_session, Approvers="test.user@example.com", StatusID=1)
    db_session.commit()

    payload = "Approved'); DROP TABLE dbo.Request;--"
    resp = client.post(
        f"/api/Request/{req.RequestID}/Approve",
        params={"reason": payload},
    )
    assert resp.status_code == 200
    assert resp.json()["ApprovalMessage"] == payload

    # Confirm the table survived and the row is still retrievable.
    verify = client.get(f"/api/Request/{req.RequestID}")
    assert verify.status_code == 200
    assert verify.json()["ApprovalMessage"] == payload
