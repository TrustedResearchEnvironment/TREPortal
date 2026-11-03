"""
Test suite for DataSource CRUD & Cascade API endpoints.

This module tests endpoints in app/datasource.py:
1. GET /api/DataSource - List datasources with paging, search, activeStatus filter
2. GET /api/DataSource/{id} - Get single datasource by ID
3. POST /api/DataSource/Add - Create new datasource with field validation
4. PUT /api/DataSource/Update/{id} - Update datasource, cascade deactivation

Test Coverage:
- Paged listing with search and active status filtering
- Single datasource lookup (found / 404)
- Create datasource with valid fields
- Create datasource with missing field returns 400
- Update datasource fields
- Cascade: deactivating a DataSource deactivates all linked DataSets
"""
from fastapi.testclient import TestClient
from app.dbtables import DataSource, DataSet, Field, DataSourceFieldValue
from datetime import datetime


# =============================================================================
# Seed Helpers
# =============================================================================

def _seed_field(db_session, name: str) -> Field:
    """Creates a Field row, returns ORM object."""
    f = Field(Name=name, Description=f"Desc for {name}", IsActive=True, ModifiedDate=datetime(2026, 1, 1))
    db_session.add(f)
    db_session.flush()
    return f


def _seed_datasource(db_session, *, name="Test DS", description="A test datasource",
                      ds_type_id=1, is_active=True, fields: dict | None = None) -> DataSource:
    """Creates a DataSource with optional field values.

    Args:
        fields: Dict mapping Field ORM objects to their string values.
    """
    ds = DataSource(
        Name=name,
        Description=description,
        DataSourceTypeID=ds_type_id,
        IsActive=is_active,
        ModifiedDate=datetime(2026, 1, 1),
        isRefreshed=False,
        RefreshedDate=None,
    )
    db_session.add(ds)
    db_session.flush()

    if fields:
        for field_obj, value in fields.items():
            fv = DataSourceFieldValue(
                DataSourceID=ds.DataSourceID,
                FieldID=field_obj.FieldID,
                Value=value,
            )
            db_session.add(fv)
        db_session.flush()

    return ds


def _seed_dataset(db_session, datasource_id: int, *, name="Test DataSet", is_active=True) -> DataSet:
    """Creates a DataSet linked to a DataSource."""
    ds = DataSet(
        Name=name,
        Description="A test dataset",
        DataSourceID=datasource_id,
        IsActive=is_active,
        ModifiedDate=datetime(2026, 1, 1),
        Approvers="approver@example.com",
        Owner="owner@example.com",
    )
    db_session.add(ds)
    db_session.flush()
    return ds


# =============================================================================
# GET /api/DataSource – Paged list
# =============================================================================


def test_list_datasources_default(client: TestClient, db_session):
    """Returns datasources in a paged response."""
    f = _seed_field(db_session, "Path")
    _seed_datasource(db_session, name="DS Alpha", fields={f: "/alpha"})
    _seed_datasource(db_session, name="DS Beta", fields={f: "/beta"})
    db_session.commit()

    resp = client.get("/api/DataSource", params={"pageSize": 100})
    assert resp.status_code == 200

    body = resp.json()
    assert "Results" in body
    names = [r["Name"] for r in body["Results"]]
    assert "DS Alpha" in names
    assert "DS Beta" in names


def test_list_datasources_search(client: TestClient, db_session):
    """Search filters by Name or Description (case-insensitive)."""
    f = _seed_field(db_session, "Path")
    _seed_datasource(db_session, name="Clinical Data", description="Clinical records", fields={f: "/clin"})
    _seed_datasource(db_session, name="Admin Data", description="Admin stuff", fields={f: "/admin"})
    db_session.commit()

    resp = client.get("/api/DataSource", params={"search": "clinical", "pageSize": 100})
    assert resp.status_code == 200

    names = [r["Name"] for r in resp.json()["Results"]]
    assert "Clinical Data" in names
    assert "Admin Data" not in names


def test_list_datasources_active_filter(client: TestClient, db_session):
    """activeStatus=0 returns only inactive, activeStatus=1 only active, 2=all."""
    f = _seed_field(db_session, "Path")
    _seed_datasource(db_session, name="Active DS", is_active=True, fields={f: "/a"})
    _seed_datasource(db_session, name="Inactive DS", is_active=False, fields={f: "/b"})
    db_session.commit()

    # Only inactive
    resp = client.get("/api/DataSource", params={"activeStatus": 0, "pageSize": 100})
    assert resp.status_code == 200
    names = [r["Name"] for r in resp.json()["Results"]]
    assert "Inactive DS" in names
    assert "Active DS" not in names

    # Only active
    resp = client.get("/api/DataSource", params={"activeStatus": 1, "pageSize": 100})
    assert resp.status_code == 200
    names = [r["Name"] for r in resp.json()["Results"]]
    assert "Active DS" in names
    assert "Inactive DS" not in names


def test_list_datasources_invalid_active_status(client: TestClient, db_session):
    """Invalid activeStatus returns 400."""
    resp = client.get("/api/DataSource", params={"activeStatus": 99})
    assert resp.status_code == 400


# =============================================================================
# GET /api/DataSource/{id} – Single datasource
# =============================================================================


def test_get_datasource_by_id(client: TestClient, db_session):
    """Returns the datasource with its fields when found."""
    f = _seed_field(db_session, "UNC Path")
    ds = _seed_datasource(db_session, name="My Source", fields={f: "\\\\server\\share"})
    db_session.commit()

    resp = client.get(f"/api/DataSource/{ds.DataSourceID}")
    assert resp.status_code == 200

    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert body[0]["Name"] == "My Source"
    assert body[0]["Fields"]["UNC Path"] == "\\\\server\\share"


def test_get_datasource_by_id_not_found(client: TestClient, db_session):
    """Returns 404 for a non-existent datasource."""
    resp = client.get("/api/DataSource/999999")
    assert resp.status_code == 404


# =============================================================================
# POST /api/DataSource/Add – Create
# =============================================================================


def test_add_datasource_success(client: TestClient, db_session):
    """Creates a datasource with valid fields."""
    _seed_field(db_session, "Server")
    _seed_field(db_session, "Database")
    db_session.commit()

    payload = {
        "Name": "New Source",
        "Description": "Created via test",
        "DataSourceTypeID": 1,
        "IsActive": True,
        "Fields": {"Server": "sql-prod", "Database": "mydb"},
    }
    resp = client.post("/api/DataSource/Add", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body["Name"] == "New Source"
    assert body["Fields"]["Server"] == "sql-prod"
    assert body["Fields"]["Database"] == "mydb"


def test_add_datasource_missing_field_returns_400(client: TestClient, db_session):
    """Referencing a field that does not exist yields 400."""
    _seed_field(db_session, "Server")
    db_session.commit()

    payload = {
        "Name": "Bad Source",
        "DataSourceTypeID": 1,
        "Fields": {"Server": "ok", "NonExistent": "bad"},
    }
    resp = client.post("/api/DataSource/Add", json=payload)
    assert resp.status_code == 400
    assert "NonExistent" in resp.json()["detail"]


def test_add_datasource_redcap_sets_refreshed(client: TestClient, db_session):
    """REDCap type (2) auto-sets isRefreshed=True and RefreshedDate."""
    _seed_field(db_session, "API URL")
    db_session.commit()

    payload = {
        "Name": "REDCap Source",
        "DataSourceTypeID": 2,
        "Fields": {"API URL": "https://redcap.local/api"},
    }
    resp = client.post("/api/DataSource/Add", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body["isRefreshed"] is True
    assert body["RefreshedDate"] is not None


# =============================================================================
# PUT /api/DataSource/Update/{id} – Update + Cascade
# =============================================================================


def test_update_datasource_fields(client: TestClient, db_session):
    """Updates name, description, and field values."""
    f = _seed_field(db_session, "Server")
    ds = _seed_datasource(db_session, name="Old Name", description="Old desc", fields={f: "old-val"})
    db_session.commit()

    payload = {
        "Name": "New Name",
        "Description": "New desc",
        "IsActive": True,
        "Fields": {"Server": "new-val"},
    }
    resp = client.put(f"/api/DataSource/Update/{ds.DataSourceID}", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert body["Name"] == "New Name"
    assert body["Description"] == "New desc"
    assert body["Fields"]["Server"] == "new-val"


def test_update_datasource_not_found(client: TestClient, db_session):
    """Updating a non-existent datasource returns 404."""
    payload = {
        "Name": "X",
        "Description": "X",
        "IsActive": True,
        "Fields": {},
    }
    resp = client.put("/api/DataSource/Update/999999", json=payload)
    assert resp.status_code == 404


def test_update_datasource_bad_field_name(client: TestClient, db_session):
    """Updating with a field name that doesn't belong to the datasource returns 400."""
    f = _seed_field(db_session, "Server")
    ds = _seed_datasource(db_session, name="DS", fields={f: "val"})
    db_session.commit()

    payload = {
        "Name": "DS",
        "Description": "DS",
        "IsActive": True,
        "Fields": {"FakeField": "nope"},
    }
    resp = client.put(f"/api/DataSource/Update/{ds.DataSourceID}", json=payload)
    assert resp.status_code == 400
    assert "FakeField" in resp.json()["detail"]


def test_update_datasource_cascade_deactivation(client: TestClient, db_session):
    """Setting IsActive=False cascades to all linked DataSets."""
    f = _seed_field(db_session, "Path")
    ds = _seed_datasource(db_session, name="Parent DS", is_active=True, fields={f: "/path"})
    dataset1 = _seed_dataset(db_session, ds.DataSourceID, name="Child DS 1", is_active=True)
    dataset2 = _seed_dataset(db_session, ds.DataSourceID, name="Child DS 2", is_active=True)
    db_session.commit()

    payload = {
        "Name": "Parent DS",
        "Description": "Deactivating",
        "IsActive": False,
        "Fields": {"Path": "/path"},
    }
    resp = client.put(f"/api/DataSource/Update/{ds.DataSourceID}", json=payload)
    assert resp.status_code == 200
    assert resp.json()["IsActive"] is False

    # Verify child datasets were deactivated
    db_session.expire_all()
    ds1_check = db_session.get(DataSet, dataset1.DataSetID)
    ds2_check = db_session.get(DataSet, dataset2.DataSetID)
    assert ds1_check.IsActive is False
    assert ds2_check.IsActive is False


def test_update_datasource_no_cascade_when_active(client: TestClient, db_session):
    """Setting IsActive=True does NOT deactivate linked DataSets."""
    f = _seed_field(db_session, "Path")
    ds = _seed_datasource(db_session, name="Parent DS", is_active=True, fields={f: "/path"})
    dataset = _seed_dataset(db_session, ds.DataSourceID, name="Child DS", is_active=True)
    db_session.commit()

    payload = {
        "Name": "Parent DS",
        "Description": "Staying active",
        "IsActive": True,
        "Fields": {"Path": "/path"},
    }
    resp = client.put(f"/api/DataSource/Update/{ds.DataSourceID}", json=payload)
    assert resp.status_code == 200

    db_session.expire_all()
    ds_check = db_session.get(DataSet, dataset.DataSetID)
    assert ds_check.IsActive is True
