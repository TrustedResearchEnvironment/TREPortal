"""
Test suite for DataSource REDCap sync endpoint.

This module tests the GET /api/DataSource/sync-redcap/{data_source_id} endpoint
which syncs REDCap data and returns column names from a REDCap project.
"""

from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
from datetime import datetime
from app.dbtables import DataSource, DataSourceType, Field, DataSourceFieldValue


def test_sync_redcap_success(client: TestClient, db_session):
    """Test successful REDCap sync returns column names."""
    
    # Setup: Create test data in database
    # Create DataSourceType
    ds_type = DataSourceType(Name="REDCap", IsActive=True)
    db_session.add(ds_type)
    db_session.flush()
    
    # Create DataSource
    ds = DataSource(
        Name="Test REDCap Source",
        DataSourceTypeID=ds_type.DataSourceTypeID,
        IsActive=True,
        Description="Test REDCap connection"
    )
    db_session.add(ds)
    db_session.flush()
    
    # Create Fields for REDCap URL (ID 4) and API Key (ID 5)
    # ensure Field ID 4 exists
    existing = db_session.query(Field).filter(Field.FieldID == 4).first()
    if not existing:
        url_field = Field(FieldID=4, Name="REDCap URL", IsActive=True, ModifiedDate=datetime.now(), isLocked=False)
        db_session.add(url_field)

    # ensure Field ID 5 exists
    existing = db_session.query(Field).filter(Field.FieldID == 5).first()
    if not existing:
        key_field = Field(FieldID=5, Name="REDCap API Key", IsActive=True, ModifiedDate=datetime.now(), isLocked=False)
        db_session.add(key_field)

    db_session.flush()
    
    # Create DataSourceFieldValues
    url_value = DataSourceFieldValue(
        DataSourceID=ds.DataSourceID,
        FieldID=4,
        Value="https://redcap.example.com/api/"
    )
    key_value = DataSourceFieldValue(
        DataSourceID=ds.DataSourceID,
        FieldID=5,
        Value="test_api_key_12345"
    )
    db_session.add_all([url_value, key_value])
    db_session.commit()
    
    # Mock the REDCap Project class
    with patch('redcap.Project') as mock_project_class:
        # Setup mock to return metadata from export_metadata()
        mock_project_instance = Mock()
        mock_project_instance.export_metadata.return_value = [
            {'field_name': 'record_id', 'field_label': 'Record ID', 'field_type': 'text', 'select_choices_or_calculations': ''},
            {'field_name': 'patient_name', 'field_label': 'Patient Name', 'field_type': 'text', 'select_choices_or_calculations': ''},
            {'field_name': 'age', 'field_label': 'Age', 'field_type': 'text', 'select_choices_or_calculations': ''},
            {'field_name': 'diagnosis', 'field_label': 'Diagnosis', 'field_type': 'radio', 'select_choices_or_calculations': '1, Yes | 0, No'},
        ]
        mock_project_class.return_value = mock_project_instance
        
        # Call the endpoint
        response = client.get(f"/api/DataSource/sync-redcap/{ds.DataSourceID}")
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "status" in data
        assert "metadata" in data
        assert data["status"] == "success"
        assert len(data["metadata"]) == 4
        assert data["metadata"][0]["field_name"] == "record_id"
        assert data["metadata"][3]["field_name"] == "diagnosis"
        
        # Verify Project was initialized with correct parameters
        mock_project_class.assert_called_once_with(
            "https://redcap.example.com/api/",
            "test_api_key_12345"
        )
        mock_project_instance.export_metadata.assert_called_once()


def test_sync_redcap_missing_url(client: TestClient, db_session):
    """Test REDCap sync fails gracefully when URL is missing."""
    
    # Setup: Create test data with only API Key (missing URL)
    ds_type = DataSourceType(Name="REDCap", IsActive=True)
    db_session.add(ds_type)
    db_session.flush()
    
    ds = DataSource(
        Name="Incomplete REDCap Source",
        DataSourceTypeID=ds_type.DataSourceTypeID,
        IsActive=True
    )
    db_session.add(ds)
    db_session.flush()
    
    # Only create API Key field (URL missing)
    key_field = Field(FieldID=5, Name="REDCap API Key", IsActive=True, ModifiedDate=datetime.now(), isLocked=False)
    db_session.add(key_field)
    db_session.flush()
    
    key_value = DataSourceFieldValue(
        DataSourceID=ds.DataSourceID,
        FieldID=5,
        Value="test_api_key"
    )
    db_session.add(key_value)
    db_session.commit()
    
    with patch('redcap.Project') as mock_project_class:
        # The Project initialization should receive None for the URL
        # which will likely cause an error
        mock_project_class.side_effect = Exception("Invalid API URL")
        
        response = client.get(f"/api/DataSource/sync-redcap/{ds.DataSourceID}")
        
        # Should return 500 due to missing URL
        assert response.status_code == 500


def test_sync_redcap_missing_api_key(client: TestClient, db_session):
    """Test REDCap sync fails gracefully when API key is missing."""
    
    # Setup: Create test data with only URL (missing API Key)
    ds_type = DataSourceType(Name="REDCap", IsActive=True)
    db_session.add(ds_type)
    db_session.flush()
    
    ds = DataSource(
        Name="Incomplete REDCap Source",
        DataSourceTypeID=ds_type.DataSourceTypeID,
        IsActive=True
    )
    db_session.add(ds)
    db_session.flush()
    
    # Only create URL field (API Key missing)
    url_field = Field(FieldID=4, Name="REDCap URL", IsActive=True, ModifiedDate=datetime.now(), isLocked=False)
    db_session.add(url_field)
    db_session.flush()
    
    url_value = DataSourceFieldValue(
        DataSourceID=ds.DataSourceID,
        FieldID=4,
        Value="https://redcap.example.com/api/"
    )
    db_session.add(url_value)
    db_session.commit()
    
    with patch('redcap.Project') as mock_project_class:
        mock_project_class.side_effect = Exception("Invalid API token")
        
        response = client.get(f"/api/DataSource/sync-redcap/{ds.DataSourceID}")
        
        # Should return 500 due to missing API key
        assert response.status_code == 500


def test_sync_redcap_nonexistent_datasource(client: TestClient, db_session):
    """Test REDCap sync with non-existent data source ID."""
    
    # Call endpoint with ID that doesn't exist
    response = client.get("/api/DataSource/sync-redcap/99999")
    
    # A non-existent DataSource should result in a 404 Not Found response,
    # rather than a 200 OK or 500 Internal Server Error.
    # The endpoint implementation should validate that the DataSource exists
    # and return 404 if it does not.
    assert response.status_code == 404


def test_sync_redcap_empty_field_names(client: TestClient, db_session):
    """Test REDCap sync when project has no fields."""
    
    # Setup
    ds_type = DataSourceType(Name="REDCap", IsActive=True)
    db_session.add(ds_type)
    db_session.flush()
    
    ds = DataSource(
        Name="Empty REDCap Source",
        DataSourceTypeID=ds_type.DataSourceTypeID,
        IsActive=True
    )
    db_session.add(ds)
    db_session.flush()
    
    # ensure Field ID 4 exists
    existing = db_session.query(Field).filter(Field.FieldID == 4).first()
    if not existing:
        url_field = Field(FieldID=4, Name="REDCap URL", IsActive=True, ModifiedDate=datetime.now(), isLocked=False)
        db_session.add(url_field)

    # ensure Field ID 5 exists
    existing = db_session.query(Field).filter(Field.FieldID == 5).first()
    if not existing:
        key_field = Field(FieldID=5, Name="REDCap API Key", IsActive=True, ModifiedDate=datetime.now(), isLocked=False)
        db_session.add(key_field)

    db_session.flush()
    
    url_value = DataSourceFieldValue(
        DataSourceID=ds.DataSourceID,
        FieldID=4,
        Value="https://redcap.example.com/api/"
    )
    key_value = DataSourceFieldValue(
        DataSourceID=ds.DataSourceID,
        FieldID=5,
        Value="test_key"
    )
    db_session.add_all([url_value, key_value])
    db_session.commit()
    
    with patch('redcap.Project') as mock_project_class:
        # Mock project with no metadata fields
        mock_project_instance = Mock()
        mock_project_instance.export_metadata.return_value = []
        mock_project_class.return_value = mock_project_instance
        
        response = client.get(f"/api/DataSource/sync-redcap/{ds.DataSourceID}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["metadata"] == []
