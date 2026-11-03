"""
Test suite for DataExport API endpoints.

This module tests both endpoints in app/dataexport.py:
1. GET /api/DataExport - List all data export jobs with pagination and search
2. POST /api/DataExport/{AssistProjectID} - Create a new data export job

Uses snapshot testing with syrupy to capture API response structures.
WireMock stubs simulate Loome Integrate API responses.

Test Coverage:
- Pagination and search filtering
- Snapshot testing for response structure validation
- Empty result sets
- Missing/default UPN handling
- Job creation with various parameters
- Response structure verification

Note: Tests work around a bug in IntegrateLib.MakeParameterString that cannot handle
None values, so LoomeAssistName must be provided as empty string or valid value.
"""
from fastapi.testclient import TestClient
import requests
import pytest

# =============================================================================
# Test Data Export Endpoints
# =============================================================================


@pytest.fixture(scope="function")
def setup_dataexport_stubs(mock_loome_urls):
    """Setup WireMock stubs specific to data export tests."""
    admin_url = f"{mock_loome_urls}/__admin/mappings"
    
    # Mock GetAllExportJobs response - Jobs for project with user filter
    requests.post(admin_url, json={
        "request": {
            "method": "GET",
            "urlPattern": "/api/v1/Projects/123/Jobs/All"
        },
        "response": {
            "status": 200,
            "jsonBody": [
                {
                    "jobId": 1001,
                    "projectId": 123,
                    "dateCreated": "2026-01-15T10:00:00Z",
                    "dateModified": "2026-01-15T10:00:00Z",
                    "createdBy": "test.user@example.com",
                    "modifiedBy": "test.user@example.com",
                    "jobName": "[PROJ-001] test.user@example.com 1737889200",
                    "logging": 0,
                    "logBatchSize": 5,
                    "agentJobId": "550e8400-e29b-41d4-a716-446655440000",
                    "emailNotificationRecipients": "",
                    "emailNotificationRuleId": 0,
                    "cancelJobFlag": False,
                    "loggingType": None,
                    "status": "Completed",
                    "lastExecution": {
                        "projectId": 123,
                        "jobExecutionId": 5001,
                        "jobId": 1001,
                        "executionGuid": "660e8400-e29b-41d4-a716-446655440001",
                        "startTime": "2026-01-15T10:05:00Z",
                        "endTime": "2026-01-15T10:10:00Z",
                        "status": "Success",
                        "partitionId": 1,
                        "jobName": "[PROJ-001] test.user@example.com 1737889200",
                        "projectMemberships": [],
                        "projectApiMemberships": None
                    },
                    "schedule": {
                        "hasSchedules": False,
                        "hasEnabledSchedules": False,
                        "ObjectId": 1001,
                        "nextExecutionDate": None
                    },
                    "retryCount": 0
                },
                {
                    "jobId": 1002,
                    "projectId": 123,
                    "dateCreated": "2026-01-18T14:30:00Z",
                    "dateModified": "2026-01-18T14:30:00Z",
                    "createdBy": "test.user@example.com",
                    "modifiedBy": "test.user@example.com",
                    "jobName": "[PROJ-002] test.user@example.com 1738166600",
                    "logging": 1,
                    "logBatchSize": 10,
                    "agentJobId": "770e8400-e29b-41d4-a716-446655440002",
                    "emailNotificationRecipients": "admin@example.com",
                    "emailNotificationRuleId": 1,
                    "cancelJobFlag": False,
                    "loggingType": "Verbose",
                    "status": "Running",
                    "lastExecution": {
                        "projectId": 123,
                        "jobExecutionId": 5002,
                        "jobId": 1002,
                        "executionGuid": "880e8400-e29b-41d4-a716-446655440003",
                        "startTime": "2026-01-18T14:35:00Z",
                        "endTime": None,
                        "status": "InProgress",
                        "partitionId": 1,
                        "jobName": "[PROJ-002] test.user@example.com 1738166600",
                        "projectMemberships": [],
                        "projectApiMemberships": None
                    },
                    "schedule": {
                        "hasSchedules": True,
                        "hasEnabledSchedules": True,
                        "ObjectId": 1002,
                        "nextExecutionDate": "2026-01-19T14:30:00Z"
                    },
                    "retryCount": 2
                }
            ]
        }
    })
    
    # Mock IntegrateNewJob - Create new job
    requests.post(admin_url, json={
        "request": {
            "method": "POST",
            "urlPath": "/api/v1/Jobs"
        },
        "response": {
            "status": 200,
            "jsonBody": {
                "jobId": 2001,
                "projectId": 123,
                "jobName": "[ASSIST-123] test.user@example.com 1737889500",
                "logging": 0,
                "emailNotificationRecipients": "",
                "emailNotificationRuleId": 0,
                "cancelJobFlag": False,
                "logBatchSize": 5,
                "retryCount": 0,
                "jobDependencyPredecessorJob": [],
                "jobDependencyJob": [],
                "jobSequence": [],
                "schedules": None,
                "emailNotificationRule": None,
                "jobExecutions": [],
                "loggingType": None,
                "taskQueues": [],
                "project": {
                    "projectId": 123,
                    "projectName": "Test Project",
                    "requiresSync": False,
                    "projectMemberships": None,
                    "projectMembershipInvites": None,
                    "tasks": None
                },
                "lastExecution": None,
                "createdBy": "test.user@example.com",
                "modifiedBy": "test.user@example.com",
                "dateCreated": "2026-01-20T10:00:00Z",
                "dateModified": "2026-01-20T10:00:00Z"
            }
        }
    })
    
    # Mock GetAllTasksAvailableForJobByID
    requests.post(admin_url, json={
        "request": {
            "method": "GET",
            "urlPattern": "/api/v1/Jobs/[0-9]+/Tasks/All"
        },
        "response": {
            "status": 200,
            "jsonBody": [
                {
                    "taskId": 3001,
                    "taskName": "Test Task",
                    "parameterNames": "LoomeAssistProjectID|LoomeAssistTenantsID|LoomeAssistProjectName|UserUPN",
                    "parameterDefaults": "default-project|default-tenant|Default Name|default@example.com"
                }
            ]
        }
    })
    
    # Mock AddTaskToJob
    requests.post(admin_url, json={
        "request": {
            "method": "POST",
            "urlPattern": "/api/v1/jobs/[0-9]+/JobSequence"
        },
        "response": {
            "status": 200,
            "jsonBody": {
                "jobSequenceId": 4001,
                "jobId": 2001,
                "taskId": 3001,
                "runSequence": 1,
                "parallelSequence": 0,
                "active": True,
                "runInParallel": False
            }
        }
    })
    
    # Mock PatchParametersForTask
    requests.post(admin_url, json={
        "request": {
            "method": "PATCH",
            "urlPattern": "/api/v1/Jobs/[0-9]+/JobSequence/[0-9]+"
        },
        "response": {
            "status": 204
        }
    })
    
    # Mock RunJobOnce
    requests.post(admin_url, json={
        "request": {
            "method": "GET",
            "urlPattern": "/api/v1/Jobs/[0-9]+/JobExecutions/RunOnce"
        },
        "response": {
            "status": 200,
            "jsonBody": {
                "jobExecutionId": 6001,
                "jobId": 2001,
                "status": "Queued",
                "startTime": "2026-01-20T10:01:00Z"
            }
        }
    })


def test_get_all_dataexports_empty(client: TestClient, setup_dataexport_stubs):
    """Test getting all data exports when no jobs match user."""
    # Override headers for a different user
    response = client.get(
        "/api/DataExport?page=1&pageSize=5",
        headers={
            "X-API-Key": "test-api-key",
            "X-UPN": "other.user@example.com"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify paged structure
    assert "CurrentPage" in data
    assert "PageCount" in data
    assert "PageSize" in data
    assert "RowCount" in data
    assert "Results" in data
    
    # No jobs for this user
    assert data["RowCount"] == 0
    assert len(data["Results"]) == 0


def test_get_all_dataexports_snapshot(client: TestClient, snapshot, setup_dataexport_stubs):
    """Test data export list response structure matches snapshot."""
    response = client.get("/api/DataExport?page=1&pageSize=5")
    
    assert response.status_code == 200
    data = response.json()
    
    # Critical assertions
    assert data["RowCount"] == 2
    assert len(data["Results"]) == 2
    
    # Snapshot the full response
    assert data == snapshot


def test_get_all_dataexports_pagination(client: TestClient, setup_dataexport_stubs):
    """Test pagination of data exports."""
    # Page 1, size 1
    response = client.get("/api/DataExport?page=1&pageSize=1")
    assert response.status_code == 200
    data = response.json()
    
    assert data["CurrentPage"] == 1
    assert data["PageSize"] == 1
    assert data["RowCount"] == 2
    assert data["PageCount"] == 2
    assert len(data["Results"]) == 1
    assert data["FirstRowOnPage"] == 1
    assert data["LastRowOnPage"] == 1
    
    # Page 2, size 1
    response = client.get("/api/DataExport?page=2&pageSize=1")
    assert response.status_code == 200
    data = response.json()
    
    assert data["CurrentPage"] == 2
    assert len(data["Results"]) == 1
    assert data["FirstRowOnPage"] == 2
    assert data["LastRowOnPage"] == 2


def test_get_all_dataexports_search(client: TestClient, setup_dataexport_stubs):
    """Test search filter on data exports."""
    # Search for PROJ-001
    response = client.get("/api/DataExport?page=1&pageSize=10&search=PROJ-001")
    assert response.status_code == 200
    data = response.json()
    
    assert data["RowCount"] == 1
    assert len(data["Results"]) == 1
    assert "PROJ-001" in data["Results"][0]["jobName"]
    
    # Search for non-existent
    response = client.get("/api/DataExport?page=1&pageSize=10&search=NONEXISTENT")
    assert response.status_code == 200
    data = response.json()
    
    assert data["RowCount"] == 0
    assert len(data["Results"]) == 0


def test_create_dataexport_requires_request_id(client: TestClient, setup_dataexport_stubs):
    """Job creation must identify the TrustAPI request it belongs to."""
    response = client.post(
        "/api/DataExport/123",
        params={
            "ExportRequestName": "request-1",
            "LoomeAssistTenantsID": "tenant-1",
        },
    )

    assert response.status_code == 422


def test_get_all_dataexports_missing_upn(client: TestClient, setup_dataexport_stubs):
    """Test that missing UPN defaults to testing upn."""
    response = client.get(
        "/api/DataExport",
        headers={"X-API-Key": "test-api-key"}  # Missing X-UPN, defaults to testing.upn
    )
    
    # With valid API key but missing UPN, it defaults to testing upn
    assert response.status_code == 200


def test_create_data_export_snapshot(client: TestClient, snapshot, setup_dataexport_stubs):
    """Test creating a new data export job."""
    response = client.post(
        "/api/DataExport/ASSIST-123",
        params={
            "LoomeAssistProjectID": "ASSIST-123",
            "LoomeAssistTenantsID": "TENANT-456",
            "LoomeAssistName": "Test Export Job"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Critical assertions
    assert data["jobId"] == 2001
    assert data["projectId"] == 123
    assert "test.user@example.com" in data["jobName"]
    assert data["project"]["projectName"] == "Test Project"
    
    # Snapshot the full response
    assert data == snapshot


def test_create_data_export_without_optional_name(client: TestClient, setup_dataexport_stubs):
    """Test creating data export with empty name parameter (bug in production code requires string)."""
    response = client.post(
        "/api/DataExport/ASSIST-999",
        params={
            "LoomeAssistProjectID": "ASSIST-999",
            "LoomeAssistTenantsID": "TENANT-999",
            "LoomeAssistName": ""  # Empty string instead of None due to bug in MakeParameterString
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["jobId"] == 2001
    assert data["projectId"] == 123


def test_create_data_export_missing_upn(client: TestClient, setup_dataexport_stubs):
    """Test that missing UPN defaults to testing upn."""
    response = client.post(
        "/api/DataExport/ASSIST-123",
        params={
            "LoomeAssistProjectID": "ASSIST-123",
            "LoomeAssistTenantsID": "TENANT-456",
            "LoomeAssistName": "Test Job"  # Required due to bug in MakeParameterString
        },
        headers={"X-API-Key": "test-api-key"}  # Missing X-UPN, defaults to testing.upn
    )
    
    # With valid API key but missing UPN, it defaults to testing upn
    assert response.status_code == 200


def test_create_data_export_verify_structure(client: TestClient, setup_dataexport_stubs):
    """Test data export creation response has correct structure."""
    response = client.post(
        "/api/DataExport/ASSIST-789",
        params={
            "LoomeAssistProjectID": "ASSIST-789",
            "LoomeAssistTenantsID": "TENANT-789",
            "LoomeAssistName": "Verify Structure"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify all required fields exist
    required_fields = [
        "jobId", "projectId", "jobName", "logging", 
        "emailNotificationRecipients", "emailNotificationRuleId",
        "cancelJobFlag", "logBatchSize", "retryCount",
        "jobDependencyPredecessorJob", "jobDependencyJob",
        "jobSequence", "schedules", "emailNotificationRule",
        "jobExecutions", "loggingType", "taskQueues",
        "project", "lastExecution", "createdBy", "modifiedBy",
        "dateCreated", "dateModified"
    ]
    
    for field in required_fields:
        assert field in data, f"Missing field: {field}"
    
    # Verify project structure
    assert "projectId" in data["project"]
    assert "projectName" in data["project"]
    assert "requiresSync" in data["project"]


def test_get_all_dataexports_response_structure(client: TestClient, setup_dataexport_stubs):
    """Test data export list response has all required fields."""
    response = client.get("/api/DataExport?page=1&pageSize=10")
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify paged result structure
    assert "CurrentPage" in data
    assert "PageCount" in data
    assert "PageSize" in data
    assert "RowCount" in data
    assert "FirstRowOnPage" in data
    assert "LastRowOnPage" in data
    assert "Results" in data
    
    # Verify job structure
    if len(data["Results"]) > 0:
        job = data["Results"][0]
        job_fields = [
            "jobId", "projectId", "dateCreated", "dateModified",
            "createdBy", "modifiedBy", "jobName", "logging",
            "logBatchSize", "agentJobId", "emailNotificationRecipients",
            "emailNotificationRuleId", "cancelJobFlag", "loggingType",
            "status", "lastExecution", "schedule", "retryCount"
        ]
        
        for field in job_fields:
            assert field in job, f"Missing field in job: {field}"
        
        # Verify lastExecution structure
        if job["lastExecution"]:
            exec_fields = [
                "projectId", "jobExecutionId", "jobId", "executionGuid",
                "startTime", "endTime", "status", "partitionId", "jobName",
                "projectMemberships", "projectApiMemberships"
            ]
            for field in exec_fields:
                assert field in job["lastExecution"], f"Missing field in lastExecution: {field}"
        
        # Verify schedule structure
        assert "hasSchedules" in job["schedule"]
        assert "hasEnabledSchedules" in job["schedule"]
        assert "ObjectId" in job["schedule"]
        assert "nextExecutionDate" in job["schedule"]
