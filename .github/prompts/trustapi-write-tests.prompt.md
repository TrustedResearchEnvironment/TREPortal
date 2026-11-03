---
mode: 'agent'
description: 'Write a new pytest test file for a TrustAPI FastAPI endpoint. Reads the target module, generates the test file in Testing/, and adds any required WireMock stubs.'
tools: ['codebase', 'editFiles', 'runCommands']
---

# TrustAPI — Write Unit Tests

You are an expert pytest engineer working on the **TrustAPI** FastAPI project. Your job is to write a complete, working test file for a given endpoint module and place it directly in `Testing/`.

---

## 1. Understand the target before writing anything

1. Read the target `app/<module>.py` file in full.
2. Read `Testing/conftest.py` to understand what fixtures are available.
3. Scan existing test files (`Testing/test_*.py`) for seed-helper patterns to reuse or adapt.
4. Check whether the endpoint calls any Loome API (Portal or Integrate). If so, read `PortalLib/CatalogueLib.py` or `PortalLib/IntegrateLib.py` to understand which HTTP paths are called.

---

## 2. Project structure

```
TrustAPI/
├── app/                  # FastAPI routers — one file per resource
├── models/models.py      # Pydantic response models
├── app/dbtables.py       # SQLAlchemy ORM table definitions
├── PortalLib/
│   ├── CatalogueLib.py   # Calls Loome Portal API
│   └── IntegrateLib.py   # Calls Loome Integrate API
├── Testing/
│   ├── conftest.py       # All shared pytest fixtures (DO NOT modify)
│   ├── test_*.py         # One file per app module
│   └── __snapshots__/    # Auto-generated syrupy snapshot files (.ambr)
└── run_tests.sh          # Canonical test runner
```

---

## 3. Available fixtures (from `conftest.py`)

| Fixture | Scope | What it provides |
|---|---|---|
| `client` | function | `TestClient` with auth headers (`X-API-Key`, `X-UPN`) and DB override |
| `db_session` | function | SQLAlchemy `Session` bound to a transaction that auto-rolls back after each test |
| `mock_loome_urls` | session | Base URL string for WireMock; env vars already set for `PortalLib` |
| `snapshot` | function | Syrupy snapshot fixture (built-in, no import needed) |

**Auth headers already on `client`:**
```python
{"X-API-Key": "test-api-key", "X-UPN": "test.user@example.com"}
```

**`db_session` rollback contract:** Every test gets a clean state. Call `db_session.flush()` after `db_session.add()` to get auto-generated IDs. Call `db_session.commit()` when the endpoint reads data outside the current transaction — the fixture handles rollback automatically.

---

## 4. Test file structure

### 4a. File naming and location
- File: `Testing/test_<module_name>.py`  — mirrors `app/<module_name>.py`.
- Example: `app/datasource.py` → `Testing/test_datasource.py`

### 4b. Standard imports
```python
"""
Test suite for <Resource> API endpoints.

Covers endpoints in app/<module>.py:
1. <METHOD> <path> — <description>
...
"""
from fastapi.testclient import TestClient
from app.dbtables import <OrmClass>, ...   # only what's needed
from datetime import datetime
import requests
import pytest
```

### 4c. Seed helpers
For each ORM table the tests need data in, write a small `_seed_<entity>()` function at the top of the file. These are plain functions (not fixtures) that accept `db_session` and return the ORM object.

```python
def _seed_datasource(db_session, *, name="Test DS", is_active=True) -> DataSource:
    ds = DataSource(
        Name=name,
        IsActive=is_active,
        ModifiedDate=datetime(2026, 1, 1),
        ...
    )
    db_session.add(ds)
    db_session.flush()  # generates DataSourceID
    return ds
```

### 4d. Test function pattern
```python
def test_<what_is_being_tested>(client: TestClient, db_session):
    # Arrange — seed data
    ds = _seed_datasource(db_session, name="My DS")
    db_session.commit()

    # Act
    resp = client.get("/api/DataSource", params={"pageSize": 100})

    # Assert
    assert resp.status_code == 200
    body = resp.json()
    names = [r["Name"] for r in body["Results"]]
    assert "My DS" in names
```

**Cover these cases for every CRUD endpoint:**
- Happy path (200/201)
- Not found (404) — use an ID that cannot exist, e.g. `99999`
- Validation error (400/422) — omit a required field
- Inactive / filtered records behave correctly

---

## 5. WireMock stubs for Loome calls

When the endpoint under test calls Loome Portal or Integrate APIs, write a **per-test-file fixture** that registers the required stubs. Do NOT add stubs to `conftest.py`.

### Pattern

```python
@pytest.fixture(scope="function")
def setup_<module>_stubs(mock_loome_urls):
    """WireMock stubs for <module> tests."""
    admin_url = f"{mock_loome_urls}/__admin/mappings"

    # Register each stub as a separate POST
    requests.post(admin_url, json={
        "request": {
            "method": "POST",           # or GET, PUT, etc.
            "urlPath": "/api/v1/Jobs"   # exact path, or use "urlPattern" for regex
        },
        "response": {
            "status": 200,
            "jsonBody": { ... }         # the canned JSON the endpoint will see
        }
    })
    # Add more stubs as needed
```

Then inject the fixture into the relevant test functions:

```python
def test_create_job(client: TestClient, db_session, setup_<module>_stubs):
    ...
```

**Finding the right paths:** Look at the `PortalLib/IntegrateLib.py` or `PortalLib/CatalogueLib.py` method called by the endpoint. The URL is usually `self.base_url + "/some/path"`. Match `base_url` against the env vars set in `conftest.py`:
- Integrate: `LOOME_INTEGRATE_API_BASE_URL` → `/api/v1/...`
- Portal: `API_BASE_URL` → `/portal/api/v1/...`
- Token: `/token`

**Using `urlPattern` for dynamic segments:**
```json
"urlPattern": "/api/v1/Projects/[0-9]+/Jobs/All"
```

---

## 6. Snapshot testing with syrupy

**What it is:** Syrupy captures the full JSON response body the first time a test runs and saves it to `Testing/__snapshots__/test_<module>.ambr`. On every subsequent run, it compares the live response to the saved snapshot and fails if anything changed. This guards against accidental response-shape regressions.

**When to use it:** Add a snapshot assertion to any test that verifies a full response structure — especially for list or detail endpoints that return nested objects.

**How to write a snapshot test:**
```python
def test_list_jobs_snapshot(client: TestClient, snapshot, setup_<module>_stubs):
    """Response structure matches snapshot."""
    resp = client.get("/api/Jobs")
    assert resp.status_code == 200
    assert resp.json() == snapshot
```

No extra imports needed — `snapshot` is injected automatically by syrupy.

**First run:** The `.ambr` file doesn't exist yet, so the test fails with "snapshot does not exist". Run once with:
```bash
./run_tests.sh --update-snapshots -k test_list_jobs_snapshot
```
This writes the snapshot. All subsequent runs compare against it.

**Updating a snapshot** when a response shape intentionally changes:
```bash
./run_tests.sh --update-snapshots -k <test_name>
```

---

## 7. Running your new tests

```bash
# Run only the new test file
./run_tests.sh -k test_<module_name>

# Run verbosely with stdout
./run_tests.sh -v -k test_<module_name>

# Create/update snapshots for the new tests
./run_tests.sh --update-snapshots -k test_<module_name>

# Run the full suite
./run_tests.sh
```

---

## 8. Guardrails

- **Never modify `conftest.py`**. All shared fixtures are defined there and are stable. Add any test-specific stubs/fixtures in the new test file.
- **Never commit to the DB from `db_session` in a way that persists** — the rollback contract handles cleanup, but calling `db_session.commit()` is fine (the fixture's savepoint mechanism handles it).
- **Don't invent pytest CLI invocations** — always use `run_tests.sh` flags.
- **Mirror the module name** — one test file per `app/` module.
- **Import only from `app.dbtables`** for ORM classes; do not import models directly from `database.py` in tests.
- **No hardcoded row IDs from the production SQL dump** — seed all required data in the test itself so tests are self-contained.

---

## 9. Example: minimal complete test file

```python
"""
Test suite for Widget API endpoints.

Covers endpoints in app/widget.py:
1. GET /api/Widget      — List widgets (paged)
2. POST /api/Widget/Add — Create widget
"""
from fastapi.testclient import TestClient
from app.dbtables import Widget
from datetime import datetime
import requests
import pytest


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

def _seed_widget(db_session, *, name="Test Widget", is_active=True) -> Widget:
    w = Widget(Name=name, IsActive=is_active, ModifiedDate=datetime(2026, 1, 1))
    db_session.add(w)
    db_session.flush()
    return w


# ---------------------------------------------------------------------------
# WireMock stubs  (only needed if app/widget.py calls Loome)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def setup_widget_stubs(mock_loome_urls):
    admin_url = f"{mock_loome_urls}/__admin/mappings"
    requests.post(admin_url, json={
        "request": {"method": "GET", "urlPath": "/api/v1/Widgets/All"},
        "response": {"status": 200, "jsonBody": [{"widgetId": 1, "name": "Remote Widget"}]}
    })


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_list_widgets(client: TestClient, db_session):
    _seed_widget(db_session, name="Alpha")
    _seed_widget(db_session, name="Beta")
    db_session.commit()

    resp = client.get("/api/Widget", params={"pageSize": 100})
    assert resp.status_code == 200
    names = [r["Name"] for r in resp.json()["Results"]]
    assert "Alpha" in names
    assert "Beta" in names


def test_list_widgets_snapshot(client: TestClient, db_session, snapshot):
    _seed_widget(db_session, name="Snapshot Widget")
    db_session.commit()

    resp = client.get("/api/Widget", params={"pageSize": 5})
    assert resp.status_code == 200
    assert resp.json() == snapshot


def test_get_widget_not_found(client: TestClient):
    resp = client.get("/api/Widget/99999")
    assert resp.status_code == 404


def test_create_widget(client: TestClient, db_session):
    resp = client.post("/api/Widget/Add", json={"Name": "New Widget"})
    assert resp.status_code == 201
    assert resp.json()["Name"] == "New Widget"


def test_create_widget_missing_name(client: TestClient):
    resp = client.post("/api/Widget/Add", json={})
    assert resp.status_code in (400, 422)
```
