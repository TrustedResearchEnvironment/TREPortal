# Testing Documentation

This document provides comprehensive guidance on the testing infrastructure for TrustAPI, including how to run tests, understand the test fixtures, and create new tests for API endpoints.

## Table of Contents
- [Overview](#overview)
- [Testing Infrastructure](#testing-infrastructure)
- [Running Tests](#running-tests)
- [Test Fixtures](#test-fixtures)
- [Writing New Tests](#writing-new-tests)
- [Example: Testing a New Endpoint](#example-testing-a-new-endpoint)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The TrustAPI testing infrastructure uses:
- **pytest**: Test framework
- **FastAPI TestClient**: For making HTTP requests to the API
- **Testcontainers**: For spinning up isolated MSSQL and WireMock containers
- **SQLAlchemy**: For database operations and transaction management
- **WireMock**: For mocking external Loome API dependencies

All tests are located in the `Testing/` directory and use fixtures defined in `conftest.py` at the project root.

## Testing Infrastructure

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Test Suite                            │
│  (Testing/test_*.py)                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   conftest.py Fixtures                       │
│  • mssql_container    • wiremock_container                  │
│  • db_engine          • db_session                          │
│  • client             • mock_loome_urls                     │
└──────────────┬──────────────────┬────────────────────────────┘
               │                  │
               ▼                  ▼
┌──────────────────────┐  ┌─────────────────────────┐
│  MSSQL Container     │  │  WireMock Container     │
│  (SQL Server 2019)   │  │  (Mock Loome APIs)      │
│  • Test Database     │  │  • Portal API           │
│  • SQL Dump Loaded   │  │  • Integrate API        │
└──────────────────────┘  └─────────────────────────┘
```

### Key Components

1. **MSSQL Testcontainer**: Provides an isolated SQL Server 2019 instance with the production schema and test data loaded from a SQL dump.
2. **WireMock Testcontainer**: Mocks external Loome Portal and Integrate API endpoints.
3. **Transaction Management**: Each test runs in a transaction that is rolled back after completion, ensuring test isolation.
4. **FastAPI TestClient**: Configured with authentication headers and database session overrides.

## Running Tests

### Run All Tests
```bash
python3 -m pytest
```

### Run Specific Test File
```bash
python3 -m pytest Testing/test_datasets.py
```

### Run Specific Test Function
```bash
python3 -m pytest Testing/test_datasets.py::test_get_datasets_populated
```

### Run with Verbose Output
```bash
python3 -m pytest -v -s
```

### Run with Coverage Report
```bash
python3 -m pytest --cov=app --cov-report=html
```

## Test Fixtures

Fixtures are defined in `conftest.py` and are automatically available to all tests. Here are the key fixtures:

### Session-Scoped Fixtures

#### `mssql_container`
Spins up a SQL Server 2019 container for the entire test session.

```python
@pytest.fixture(scope="session")
def mssql_container():
    """Spins up a MSSQL Server container."""
    mssql = SqlServerContainer("mcr.microsoft.com/mssql/server:2019-latest")
    mssql.start()
    yield mssql
    mssql.stop()
```

#### `wiremock_container`
Spins up a WireMock container for mocking external APIs.

```python
@pytest.fixture(scope="session")
def wiremock_container():
    """Spins up a WireMock container for mocking Loome APIs."""
    wiremock = DockerContainer("wiremock/wiremock:latest")
    wiremock.with_exposed_ports(8080)
    wiremock.start()
    yield wiremock
    wiremock.stop()
```

#### `db_engine`
Creates a SQLAlchemy engine and loads the SQL dump into the test database.

**Key Features:**
- Creates the target database `sqldb-workflow-prod-ase-01`
- Loads schema and data from `sqldumps/sqldb-workflow-prod-ase-01-09282025-ALL.sql`
- Handles UTF-16 encoding and `GO` batch separators
- Executes in `AUTOCOMMIT` mode to support DDL statements

#### `mock_loome_urls`
Configures environment variables to point to WireMock instead of real Loome APIs.

#### `setup_wiremock_stubs`
Registers default WireMock stubs for common Loome API endpoints (authentication, projects, custom apps, etc.).

### Function-Scoped Fixtures

#### `db_session`
Provides a database session for each test with automatic rollback.

**Key Features:**
- Uses nested transactions (savepoints) to handle `session.commit()` calls in application code
- Automatically rolls back all changes after the test completes
- Ensures test isolation

**Usage:**
```python
def test_example(db_session):
    # Add test data
    obj = MyModel(name="test")
    db_session.add(obj)
    db_session.commit()  # This commits to a savepoint, not the outer transaction
    
    # Test continues...
    # All changes are rolled back after the test
```

#### `client`
Provides a configured FastAPI TestClient.

**Key Features:**
- Overrides `get_db` to use the test `db_session`
- Patches the global database engine
- Injects authentication headers (`X-API-Key`, `X-UPN`)

**Usage:**
```python
def test_example(client: TestClient):
    response = client.get("/api/DataSet")
    assert response.status_code == 200
```

## Writing New Tests

### Test File Structure

1. Create a new test file in `Testing/` directory with the naming pattern `test_*.py`
2. Import necessary dependencies
3. Write test functions with descriptive names starting with `test_`

### Basic Test Template

```python
from fastapi.testclient import TestClient

def test_endpoint_name(client: TestClient):
    """Test description."""
    # Arrange: Set up test data
    
    # Act: Make API request
    response = client.get("/api/YourEndpoint")
    
    # Assert: Verify response
    assert response.status_code == 200
    data = response.json()
    assert "expected_field" in data
```

### Test with Database Operations

```python
from fastapi.testclient import TestClient
from app.dbtables import YourModel

def test_with_db(client: TestClient, db_session):
    """Test that requires database setup."""
    # Arrange: Seed test data
    test_obj = YourModel(name="Test", value=123)
    db_session.add(test_obj)
    db_session.commit()
    
    # Act: Make API request
    response = client.get(f"/api/YourEndpoint/{test_obj.id}")
    
    # Assert: Verify response
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test"
```

## Example: Testing a New Endpoint

Let's create a comprehensive test for a hypothetical `/api/DataSource` endpoint.

### Step 1: Review the API Endpoint

First, understand what the endpoint does. For example, `GET /api/DataSource` might return a list of data sources.

### Step 2: Create Test File

Create `Testing/test_datasources.py`:

```python
from fastapi.testclient import TestClient
from app.dbtables import DataSource, DataSourceType

def test_get_all_datasources(client: TestClient):
    """Test getting all data sources."""
    # Act
    response = client.get("/api/DataSource")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "Results" in data
    assert isinstance(data["Results"], list)

def test_get_datasource_by_id(client: TestClient, db_session):
    """Test getting a specific data source by ID."""
    # Arrange: Create test data
    ds_type = DataSourceType(Name="Test Type", IsActive=True)
    db_session.add(ds_type)
    db_session.flush()
    
    datasource = DataSource(
        Name="Test DataSource",
        DataSourceTypeID=ds_type.DataSourceTypeID,
        IsActive=True
    )
    db_session.add(datasource)
    db_session.commit()
    
    # Act
    response = client.get(f"/api/DataSource/{datasource.DataSourceID}")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["Name"] == "Test DataSource"
    assert data["DataSourceID"] == datasource.DataSourceID

def test_create_datasource(client: TestClient, db_session):
    """Test creating a new data source."""
    # Arrange: Get initial count
    initial_response = client.get("/api/DataSource?pageSize=100")
    initial_count = len(initial_response.json().get("Results", []))
    
    # Seed dependencies
    ds_type = DataSourceType(Name="SQL Database", IsActive=True)
    db_session.add(ds_type)
    db_session.commit()
    
    # Prepare request payload
    new_datasource = {
        "Name": "New Test DataSource",
        "DataSourceTypeID": ds_type.DataSourceTypeID,
        "IsActive": True,
        "ConnectionString": "Server=test;Database=test"
    }
    
    # Act
    response = client.post("/api/DataSource/Create", json=new_datasource)
    
    # Assert
    assert response.status_code == 200, f"Response: {response.text}"
    data = response.json()
    assert data["Name"] == "New Test DataSource"
    assert data["DataSourceID"] is not None
    
    # Verify it appears in the list
    list_response = client.get("/api/DataSource?pageSize=100")
    assert len(list_response.json()["Results"]) == initial_count + 1

def test_update_datasource(client: TestClient, db_session):
    """Test updating an existing data source."""
    # Arrange: Create initial data
    ds_type = DataSourceType(Name="Test Type", IsActive=True)
    db_session.add(ds_type)
    db_session.flush()
    
    datasource = DataSource(
        Name="Original Name",
        DataSourceTypeID=ds_type.DataSourceTypeID,
        IsActive=True
    )
    db_session.add(datasource)
    db_session.commit()
    
    # Prepare update payload
    update_data = {
        "Name": "Updated Name",
        "DataSourceTypeID": ds_type.DataSourceTypeID,
        "IsActive": False
    }
    
    # Act
    response = client.put(
        f"/api/DataSource/Update/{datasource.DataSourceID}",
        json=update_data
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["Name"] == "Updated Name"
    assert data["IsActive"] == False

def test_datasource_not_found(client: TestClient):
    """Test getting a non-existent data source returns 404."""
    # Act
    response = client.get("/api/DataSource/99999")
    
    # Assert
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()

def test_create_datasource_invalid_data(client: TestClient):
    """Test creating a data source with invalid data returns 400."""
    # Arrange: Invalid payload (missing required fields)
    invalid_data = {
        "Name": "Test"
        # Missing DataSourceTypeID
    }
    
    # Act
    response = client.post("/api/DataSource/Create", json=invalid_data)
    
    # Assert
    assert response.status_code == 422  # Validation error
```

### Step 3: Run the Tests

```bash
python3 -m pytest Testing/test_datasources.py -v
```

## Best Practices

### 1. Test Isolation
- Each test should be independent and not rely on other tests
- Use `db_session` fixture to ensure database changes are rolled back
- Don't share state between tests

### 2. Descriptive Names
```python
# Good
def test_get_dataset_returns_404_when_not_found(client):
    ...

# Bad
def test_dataset(client):
    ...
```

### 3. Arrange-Act-Assert Pattern
```python
def test_example(client):
    # Arrange: Set up test data and preconditions
    test_data = {...}
    
    # Act: Perform the action being tested
    response = client.post("/api/endpoint", json=test_data)
    
    # Assert: Verify the outcome
    assert response.status_code == 200
```

### 4. Use Meaningful Assertions
```python
# Good
assert response.status_code == 200, f"Unexpected response: {response.text}"
assert data["Name"] == "Expected Name"

# Bad
assert response.status_code == 200
assert data
```

### 5. Handle Pagination
When testing list endpoints, use `pageSize` parameter to ensure all results are returned:
```python
response = client.get("/api/DataSet?pageSize=100")
```

### 6. Test Edge Cases
- Empty results
- Invalid IDs (404 errors)
- Invalid data (422 validation errors)
- Boundary conditions

### 7. Seed Dependencies Carefully
When creating test data, ensure all foreign key dependencies are satisfied:
```python
# Create parent first
parent = ParentModel(name="Parent")
db_session.add(parent)
db_session.flush()  # Get the ID

# Then create child
child = ChildModel(parent_id=parent.id, name="Child")
db_session.add(child)
db_session.commit()
```

## Troubleshooting

### Tests Fail with "Database not found"
- Ensure the `db_engine` fixture is creating the database correctly
- Check that `db_connection_url` points to the correct database name

### Tests Fail with "Permission denied" or "Login failed"
- Verify the MSSQL container is running with the correct credentials
- Check that the connection string uses the correct username/password

### WireMock Stubs Not Working
- Verify `setup_wiremock_stubs` fixture is being called (it's `autouse=True`)
- Check WireMock admin URL: `http://localhost:<port>/__admin/mappings`
- Ensure environment variables are set by `mock_loome_urls` fixture

### Transaction Rollback Issues
- If changes persist between tests, verify `db_session` fixture is being used
- Check that the test is not committing to the outer transaction
- Review the nested transaction event listener in `conftest.py`

### Slow Test Execution
- Testcontainers startup is slow on first run (pulling images)
- Use session-scoped fixtures to reuse containers across tests
- Consider running tests in parallel with `pytest-xdist`:
  ```bash
  python3 -m pytest -n auto
  ```

### Import Errors
- Ensure all test dependencies are installed: `pip install -r requirements.txt`
- Verify the project root is in `PYTHONPATH`

## Additional Resources

- [pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing Guide](https://fastapi.tiangolo.com/tutorial/testing/)
- [Testcontainers Python](https://testcontainers-python.readthedocs.io/)
- [WireMock Documentation](http://wiremock.org/docs/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites)
