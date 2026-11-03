"""
Test suite for batch upsert endpoints.

This module tests:
1. POST /api/DataSetColumns/{data_set_id} - Batch create/update DataSetColumn records
2. GET /api/DataSetColumns/DataSetID/{data_set_id} - List columns by DataSetID (paged)
3. POST /api/DataSetMetaDataValue/{data_set_id} - Batch create/update metadata values
4. GET /api/DataSetMetaDataValue/DataSetID/{data_set_id} - List metadata by DataSetID

Test Coverage:
- Batch create (new rows)
- Batch update (existing rows)
- Mixed upsert (some create, some update)
- 404 for invalid IDs in update path
- GET retrieval after mutations
"""
import pytest
from fastapi.testclient import TestClient
from app.dbtables import DataSet, DataSetColumn, DataSetMetaDataValue
from datetime import datetime


# =============================================================================
# Seed Helpers
# =============================================================================

def _seed_dataset(db_session, name="Test DataSet") -> DataSet:
    ds = DataSet(
        Name=name,
        Description="Test dataset",
        DataSourceID=1,
        IsActive=True,
        ModifiedDate=datetime(2026, 1, 1),
        Approvers="approver@example.com",
        Owner="owner@example.com",
    )
    db_session.add(ds)
    db_session.flush()
    return ds


def _seed_column(db_session, dataset_id: int, **overrides) -> DataSetColumn:
    defaults = dict(
        DataSetID=dataset_id,
        ColumnName="col1",
        ColumnType="varchar",
        LogicalColumnName="Column One",
        BusinessDescription="First column",
        ExampleValue="abc",
        Tokenise=False,
        TokenIdentifierType=0,
        Redact=False,
        DisplayOrder=1,
        IsFilter=False,
    )
    defaults.update(overrides)
    col = DataSetColumn(**defaults)
    db_session.add(col)
    db_session.flush()
    return col


def _seed_metadata_value(db_session, dataset_id: int, metadata_id: int, value: str) -> DataSetMetaDataValue:
    mv = DataSetMetaDataValue(
        DataSetID=dataset_id,
        MetaDataID=metadata_id,
        Value=value,
    )
    db_session.add(mv)
    db_session.flush()
    return mv


# =============================================================================
# POST /api/DataSetColumns/{data_set_id} – Batch upsert
# =============================================================================


def test_batch_create_columns(client: TestClient, db_session):
    """Creating new columns (DataSetColumnID=0) inserts rows."""
    ds = _seed_dataset(db_session)
    db_session.commit()

    payload = [
        {
            "DataSetColumnID": 0,
            "DataSetID": ds.DataSetID,
            "ColumnName": "first_name",
            "ColumnType": "varchar",
            "LogicalColumnName": "First Name",
            "BusinessDescription": "Patient first name",
            "ExampleValue": "Jane",
            "Tokenise": False,
            "TokenIdentifierType": 0,
            "Redact": False,
            "DisplayOrder": 1,
            "IsFilter": False,
        },
        {
            "DataSetColumnID": 0,
            "DataSetID": ds.DataSetID,
            "ColumnName": "last_name",
            "ColumnType": "varchar",
            "LogicalColumnName": "Last Name",
            "BusinessDescription": "Patient last name",
            "ExampleValue": "Doe",
            "Tokenise": False,
            "TokenIdentifierType": 0,
            "Redact": True,
            "DisplayOrder": 2,
            "IsFilter": False,
        },
    ]

    resp = client.post(f"/api/DataSetColumns/{ds.DataSetID}", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert len(body) == 2
    assert body[0]["ColumnName"] == "first_name"
    assert body[1]["ColumnName"] == "last_name"
    # New rows should have real IDs
    assert body[0]["DataSetColumnID"] > 0
    assert body[1]["DataSetColumnID"] > 0


def test_batch_update_columns(client: TestClient, db_session):
    """Updating existing columns modifies the editable fields."""
    ds = _seed_dataset(db_session)
    col = _seed_column(db_session, ds.DataSetID, ColumnName="age", LogicalColumnName="Old Name")
    db_session.commit()

    payload = [
        {
            "DataSetColumnID": col.DataSetColumnID,
            "DataSetID": ds.DataSetID,
            "ColumnName": "age",
            "ColumnType": "int",
            "LogicalColumnName": "Updated Name",
            "BusinessDescription": "Updated desc",
            "ExampleValue": "42",
            "Tokenise": True,
            "TokenIdentifierType": 0,
            "Redact": True,
            "DisplayOrder": 1,
            "IsFilter": True,
        }
    ]

    resp = client.post(f"/api/DataSetColumns/{ds.DataSetID}", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert len(body) == 1
    assert body[0]["LogicalColumnName"] == "Updated Name"
    assert body[0]["Redact"] is True
    assert body[0]["Tokenise"] is True
    assert body[0]["IsFilter"] is True


def test_batch_mixed_upsert_columns(client: TestClient, db_session):
    """Mix of creates and updates in a single batch."""
    ds = _seed_dataset(db_session)
    existing = _seed_column(db_session, ds.DataSetID, ColumnName="existing_col", LogicalColumnName="Old")
    db_session.commit()

    payload = [
        # Update existing
        {
            "DataSetColumnID": existing.DataSetColumnID,
            "DataSetID": ds.DataSetID,
            "ColumnName": "existing_col",
            "ColumnType": "varchar",
            "LogicalColumnName": "Refreshed",
            "BusinessDescription": "refreshed desc",
            "ExampleValue": "x",
            "Tokenise": False,
            "TokenIdentifierType": 0,
            "Redact": False,
            "DisplayOrder": 1,
            "IsFilter": False,
        },
        # Create new
        {
            "DataSetColumnID": 0,
            "DataSetID": ds.DataSetID,
            "ColumnName": "new_col",
            "ColumnType": "int",
            "LogicalColumnName": "New Column",
            "BusinessDescription": "brand new",
            "ExampleValue": "1",
            "Tokenise": False,
            "TokenIdentifierType": 0,
            "Redact": False,
            "DisplayOrder": 2,
            "IsFilter": False,
        },
    ]

    resp = client.post(f"/api/DataSetColumns/{ds.DataSetID}", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert len(body) == 2
    updated = next(c for c in body if c["ColumnName"] == "existing_col")
    created = next(c for c in body if c["ColumnName"] == "new_col")
    assert updated["LogicalColumnName"] == "Refreshed"
    assert created["DataSetColumnID"] > 0


def test_batch_update_column_not_found(client: TestClient, db_session):
    """Updating a non-existent column ID returns 404."""
    ds = _seed_dataset(db_session)
    db_session.commit()

    payload = [
        {
            "DataSetColumnID": 999999,
            "DataSetID": ds.DataSetID,
            "ColumnName": "ghost",
            "ColumnType": "varchar",
            "LogicalColumnName": "Ghost",
            "BusinessDescription": "nope",
            "ExampleValue": "",
            "Tokenise": False,
            "TokenIdentifierType": 0,
            "Redact": False,
            "DisplayOrder": 1,
            "IsFilter": False,
        }
    ]

    resp = client.post(f"/api/DataSetColumns/{ds.DataSetID}", json=payload)
    assert resp.status_code == 404


# =============================================================================
# GET /api/DataSetColumns/DataSetID/{data_set_id} – Paged list
# =============================================================================


def test_get_columns_by_dataset_id(client: TestClient, db_session):
    """Lists columns for a dataset in paged format."""
    ds = _seed_dataset(db_session)
    _seed_column(db_session, ds.DataSetID, ColumnName="col_a")
    _seed_column(db_session, ds.DataSetID, ColumnName="col_b")
    db_session.commit()

    resp = client.get(
        f"/api/DataSetColumns/DataSetID/{ds.DataSetID}",
        params={"page": 1, "pageSize": 100},
    )
    assert resp.status_code == 200

    body = resp.json()
    assert "Results" in body
    assert body["RowCount"] >= 2
    col_names = [c["ColumnName"] for c in body["Results"]]
    assert "col_a" in col_names
    assert "col_b" in col_names


# =============================================================================
# POST /api/DataSetMetaDataValue/{data_set_id} – Batch upsert
# =============================================================================


def test_batch_create_metadata_values(client: TestClient, db_session):
    """Creating new metadata values (DataSetMetaDataValueID=None) inserts rows."""
    ds = _seed_dataset(db_session)
    db_session.commit()

    payload = [
        {"DataSetMetaDataValueID": None, "DataSetID": ds.DataSetID, "MetaDataID": 1, "Value": "val_a"},
        {"DataSetMetaDataValueID": None, "DataSetID": ds.DataSetID, "MetaDataID": 2, "Value": "val_b"},
    ]

    resp = client.post(f"/api/DataSetMetaDataValue/{ds.DataSetID}", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert len(body) == 2
    assert body[0]["Value"] == "val_a"
    assert body[1]["Value"] == "val_b"
    assert body[0]["DataSetMetaDataValueID"] is not None


def test_batch_update_metadata_values(client: TestClient, db_session):
    """Updating existing metadata values changes only the Value field."""
    ds = _seed_dataset(db_session)
    mv = _seed_metadata_value(db_session, ds.DataSetID, metadata_id=10, value="old")
    db_session.commit()

    payload = [
        {
            "DataSetMetaDataValueID": mv.DataSetMetaDataValueID,
            "DataSetID": ds.DataSetID,
            "MetaDataID": 10,
            "Value": "new_value",
        }
    ]

    resp = client.post(f"/api/DataSetMetaDataValue/{ds.DataSetID}", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert len(body) == 1
    assert body[0]["Value"] == "new_value"
    assert body[0]["DataSetMetaDataValueID"] == mv.DataSetMetaDataValueID


def test_batch_mixed_upsert_metadata(client: TestClient, db_session):
    """Mix of creates and updates for metadata values."""
    ds = _seed_dataset(db_session)
    existing = _seed_metadata_value(db_session, ds.DataSetID, metadata_id=5, value="original")
    db_session.commit()

    payload = [
        # Update
        {
            "DataSetMetaDataValueID": existing.DataSetMetaDataValueID,
            "DataSetID": ds.DataSetID,
            "MetaDataID": 5,
            "Value": "modified",
        },
        # Create
        {
            "DataSetMetaDataValueID": None,
            "DataSetID": ds.DataSetID,
            "MetaDataID": 6,
            "Value": "brand_new",
        },
    ]

    resp = client.post(f"/api/DataSetMetaDataValue/{ds.DataSetID}", json=payload)
    assert resp.status_code == 200

    body = resp.json()
    assert len(body) == 2
    updated = next(m for m in body if m["MetaDataID"] == 5)
    created = next(m for m in body if m["MetaDataID"] == 6)
    assert updated["Value"] == "modified"
    assert created["Value"] == "brand_new"


def test_batch_update_metadata_not_found(client: TestClient, db_session):
    """Updating a non-existent metadata value ID returns 404."""
    ds = _seed_dataset(db_session)
    db_session.commit()

    payload = [
        {
            "DataSetMetaDataValueID": 999999,
            "DataSetID": ds.DataSetID,
            "MetaDataID": 1,
            "Value": "ghost",
        }
    ]

    resp = client.post(f"/api/DataSetMetaDataValue/{ds.DataSetID}", json=payload)
    assert resp.status_code == 404


# =============================================================================
# GET /api/DataSetMetaDataValue/DataSetID/{data_set_id} – List
# =============================================================================


def test_get_metadata_values_by_dataset_id(client: TestClient, db_session):
    """Lists all metadata values for a dataset."""
    ds = _seed_dataset(db_session)
    _seed_metadata_value(db_session, ds.DataSetID, metadata_id=1, value="alpha")
    _seed_metadata_value(db_session, ds.DataSetID, metadata_id=2, value="beta")
    db_session.commit()

    resp = client.get(f"/api/DataSetMetaDataValue/DataSetID/{ds.DataSetID}")
    assert resp.status_code == 200

    body = resp.json()
    assert len(body) >= 2
    values = [m["Value"] for m in body]
    assert "alpha" in values
    assert "beta" in values
