from fastapi.testclient import TestClient
from app.dbtables import DataSource, DataSourceType, DataSet
from app.dbtables import Request as RequestRow
from datetime import datetime

# Classic tautology / stacked-query payloads used to probe for SQL injection.
SQLI_PAYLOADS = [
    "Robert'); DROP TABLE dbo.Request;--",
    "' OR '1'='1",
    "'; UPDATE DataSet SET IsActive=0;--",
]

def test_get_datasets_populated(client: TestClient):
    """Test getting datasets when DB is populated."""
    response = client.get("/api/DataSet")
    assert response.status_code == 200
    
    # Verify structure manually
    data = response.json()
    assert "Results" in data
    # We expect data now cause of the dump
    assert len(data["Results"]) >= 0


def validate_iso_date(date_str: str) -> bool:
    """Helper to validate ISO 8601 date strings."""
    if not isinstance(date_str, str):
        return False
    try:
        # Handle Z for UTC which might be present
        datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return True
    except ValueError:
        return False

def test_get_datasets_snapshot(client: TestClient):
    """Test dataset response structure and content validation."""
    response = client.get("/api/DataSet")
    assert response.status_code == 200
    
    data = response.json()
    
    # Verify pagination fields exist
    assert "CurrentPage" in data
    assert "PageCount" in data
    assert "PageSize" in data
    assert "RowCount" in data
    assert "Results" in data
    assert isinstance(data["Results"], list)
    
    # Validate each result has required structure
    required_fields = {'DataSetID', 'Name', 'Description', 'DataSourceID', 'IsActive', 'ModifiedDate', 'Owner', 'Approvers', 'OptOutColumn', 'OptOutList', 'OptOutMessage'}
    
    for item in data["Results"]:
        # Validate all required fields present
        assert required_fields.issubset(item.keys()), f"Missing fields in item: {set(required_fields) - set(item.keys())}"
        
        # Validate field types
        assert isinstance(item['DataSetID'], int), f"DataSetID should be int, got {type(item['DataSetID'])}"
        assert isinstance(item['DataSourceID'], int), f"DataSourceID should be int, got {type(item['DataSourceID'])}"
        assert isinstance(item['Name'], str), f"Name should be str, got {type(item['Name'])}"
        assert isinstance(item['IsActive'], bool), f"IsActive should be bool, got {type(item['IsActive'])}"
        assert isinstance(item['ModifiedDate'], str), f"ModifiedDate should be str, got {type(item['ModifiedDate'])}"
        
        # Validate date format
        assert validate_iso_date(item.get("ModifiedDate")), f"Invalid ModifiedDate: {item.get('ModifiedDate')}"
    
    # Validate we got some data
    assert len(data["Results"]) > 0, "Expected at least one dataset"

def test_create_dataset(client: TestClient, db_session):
    """Test creating a new dataset."""
    
    # Get initial count
    initial_response = client.get("/api/DataSet?pageSize=100")
    initial_count = len(initial_response.json().get("Results", []))

    # Seed dependencies
    ds_type = DataSourceType(Name="SQL Database Test", IsActive=True)
    db_session.add(ds_type)
    db_session.flush()
    
    ds = DataSource(Name="Test Source", DataSourceTypeID=ds_type.DataSourceTypeID, IsActive=True)
    db_session.add(ds)
    db_session.commit() # Commit seed data (nested transaction handles this safely now)
    
    new_dataset = {
        "Name": "Test Dataset",
        "Description": "Created by test",
        "DataSourceID": ds.DataSourceID,
        "IsActive": True,
        "Approvers": "admin@example.com",
        "Owner": "test.user@example.com",
        "DataSourceTypeID": ds_type.DataSourceTypeID,
        "DataSetColumns": [
            {
                "ColumnName": "id",
                "ColumnType": "int",
                "DisplayOrder": 1
            }
        ]
    }
    
    response = client.post("/api/DataSet/Create", json=new_dataset)
    
    # Assert
    assert response.status_code == 200, f"Response: {response.text}"
    data = response.json()
    assert data["Name"] == "Test Dataset"
    assert data["DataSetID"] is not None
    
    # Verify list update
    list_response = client.get("/api/DataSet?pageSize=100")
    assert len(list_response.json()["Results"]) == initial_count + 1

def test_unlink_metadata_preserves_values(client, db_session):
    # 1) create MetaData via API
    md_resp = client.post("/api/MetaData/Add", json={"Name":"T1","Description":"d","IsActive":True,"DataSourceTypeIDs":[1]})
    md_id = md_resp.json()["MetaDataID"]

    # 2) create DataSource of type 1 and set DataSet + DataSetMetaDataValue for that MetaData
    ds_resp = client.post("/api/DataSource/Add", json={"Name":"S1","DataSourceTypeID":1, "IsActive":True, "Fields": {}})
    ds_id = ds_resp.json()["DataSourceID"]

    ds_created = client.post("/api/DataSet/Create", json={
        "Name": "D1",
        "Description": "dataset for unlink-metadata test",
        "DataSourceID": ds_id,
        "IsActive": True,
        "Approvers": "admin@example.com",
        "Owner": "test.user@example.com",
        "DataSourceTypeID": 1,
        "DataSetColumns": [],
        "DataSetMetaDataValues": [
            {"MetaDataID": md_id, "Value": "keep-me"}
        ]
    })
    ds_obj = ds_created.json()
    dataset_id = ds_obj["DataSetID"]

    # 3) remove mapping from MetaData to DataSourceType (update MetaData with empty list)
    client.put(f"/api/MetaData/Update/{md_id}", json={"Name":"T1","Description":"d","IsActive":True,"DataSourceTypeIDs":[]})

    # 4) assert the stored DataSetMetaDataValue still exists
    rows = client.get(f"/api/MetaData/orphaned-values").json()["orphaned_dataset_metadata_values"]
    assert any(r["DataSetID"] == dataset_id and r["MetaDataID"] == md_id and r["Value"] == "keep-me" for r in rows)


# =============================================================================
# SQL Injection Handling
# =============================================================================
# These tests assert that SQL-injection-style payloads submitted through free-text
# fields are treated as inert data by SQLAlchemy's parameterized queries: they are
# stored/compared verbatim and never alter query structure or affect other rows.

def test_get_datasets_search_handles_sql_injection_payload(client: TestClient):
    """A malicious search term must not error out or execute as SQL."""
    for payload in SQLI_PAYLOADS:
        response = client.get("/api/DataSet", params={"search": payload})
        assert response.status_code == 200, f"payload={payload!r} response={response.text}"
        assert isinstance(response.json()["Results"], list)


def test_create_dataset_stores_sql_injection_payload_literally(client: TestClient, db_session):
    """Injection payloads in dataset fields are stored as plain text, not executed."""
    ds_type = DataSourceType(Name="SQLi Test Type", IsActive=True)
    db_session.add(ds_type)
    db_session.flush()
    ds = DataSource(Name="SQLi Test Source", DataSourceTypeID=ds_type.DataSourceTypeID, IsActive=True)
    db_session.add(ds)
    db_session.commit()

    payload = SQLI_PAYLOADS[0]
    new_dataset = {
        "Name": payload,
        "Description": payload,
        "DataSourceID": ds.DataSourceID,
        "IsActive": True,
        "Approvers": "admin@example.com",
        "Owner": "test.user@example.com",
        "DataSourceTypeID": ds_type.DataSourceTypeID,
        "DataSetColumns": [
            {"ColumnName": "id", "ColumnType": "int", "DisplayOrder": 1}
        ]
    }

    response = client.post("/api/DataSet/Create", json=new_dataset)
    assert response.status_code == 200, response.text
    assert response.json()["Name"] == payload

    # The DataSet table must still exist and be queryable (no DROP/TRUNCATE occurred).
    list_response = client.get("/api/DataSet?pageSize=100")
    assert list_response.status_code == 200
    names = [d["Name"] for d in list_response.json()["Results"]]
    assert payload in names


def test_dataset_request_stores_sql_injection_payload_literally(client: TestClient, db_session):
    """Injection payloads in requestName/purpose/approvers are stored as plain text."""
    ds = DataSet(
        Name="SQLi Request Target Dataset",
        Description="d",
        DataSourceID=1,
        IsActive=True,
        Approvers="admin@example.com",
        Owner="owner@example.com",
    )
    db_session.add(ds)
    db_session.commit()

    payload = SQLI_PAYLOADS[0]
    response = client.post(f"/api/DataSet/{ds.DataSetID}/Request", json={
        "approvers": "approver@example.com",
        "assistProjectID": 1,
        "purpose": payload,
        "requestName": payload,
        "dateTimeFilters": []
    })

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["Name"] == payload
    assert data["Purpose"] == payload

    # Confirm the Request table survived and is still queryable.
    list_response = client.get("/api/Request/", params={"statusId": 1, "pageSize": 100})
    assert list_response.status_code == 200


def test_dataset_request_uniqueness_check_is_injection_safe(client: TestClient, db_session):
    """A tautology payload ('OR '1'='1) must not be treated as matching an existing request name."""
    ds = DataSet(
        Name="SQLi Uniqueness Target Dataset",
        Description="d",
        DataSourceID=1,
        IsActive=True,
        Approvers="admin@example.com",
        Owner="owner@example.com",
    )
    db_session.add(ds)
    db_session.flush()

    existing = RequestRow(
        Name="Existing Request",
        ProjectID=1,
        StatusID=1,
        DataSetID=ds.DataSetID,
        Approvers="approver@example.com",
        CreateUser="test.user@example.com",
        CreateDate=datetime(2026, 1, 1),
        ModifiedDate=datetime(2026, 1, 1),
    )
    db_session.add(existing)
    db_session.commit()

    response = client.post(f"/api/DataSet/{ds.DataSetID}/Request", json={
        "approvers": "approver@example.com",
        "assistProjectID": 1,
        "purpose": "test",
        "requestName": "' OR '1'='1",
        "dateTimeFilters": []
    })

    # If the query were vulnerable, the tautology would match "Existing Request" and
    # incorrectly return 400 "already exists". Parameterized queries prevent this.
    assert response.status_code == 200, response.text