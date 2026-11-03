import os

# Set testing mode BEFORE any application imports
os.environ["TESTING"] = "true"

import pytest
import time
import requests
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from testcontainers.mssql import SqlServerContainer
from testcontainers.core.generic import DockerContainer
from testcontainers.core.wait_strategies import LogMessageWaitStrategy

# Import application components
from database import Base, get_db
import database
# Import models to ensure they are registered with Base.metadata
from app import dbtables  # noqa

# -----------------------------------------------------------------------------
# Testcontainers Fixtures
# -----------------------------------------------------------------------------

@pytest.fixture(scope="session")
def mssql_container():
    """Spins up a MSSQL Server container."""
    # Note: Accept EULA is handled by the container wrapper usually, 
    # but strictly speaking strict standard mssql container needs it. 
    # testcontainers-python SqlServerContainer handles it.
    mssql = SqlServerContainer("mcr.microsoft.com/mssql/server:2019-latest")
    mssql = mssql.waiting_for(LogMessageWaitStrategy("SQL Server is now ready for client connections"))
    mssql.start()
    yield mssql
    mssql.stop()

@pytest.fixture(scope="session")
def wiremock_container():
    """Spins up a WireMock container for mocking Loome APIs."""
    wiremock = DockerContainer("wiremock/wiremock:latest")
    wiremock.with_exposed_ports(8080)
    wiremock.with_command("--verbose")  # Enable verbose logging for debugging
    wiremock.start()
    
    # Wait for WireMock to be ready - it logs "verbose:" when starting in verbose mode
    # or we can just wait for the container to be running and then check health
    time.sleep(2)  # Give WireMock time to fully start
    
    # Verify WireMock is responding
    host = wiremock.get_container_host_ip()
    port = wiremock.get_exposed_port(8080)
    max_retries = 10
    for i in range(max_retries):
        try:
            response = requests.get(f"http://{host}:{port}/__admin/", timeout=1)
            if response.status_code in (200, 404):  # 404 is ok, means WireMock is up
                break
        except requests.exceptions.RequestException:
            if i == max_retries - 1:
                raise
            time.sleep(0.5)
    
    yield wiremock
    wiremock.stop()

@pytest.fixture(scope="session")
def db_connection_url(mssql_container):
    """Returns the connection string for the test database."""
    # Testcontainers returns a driver string that might need adjustment for the environment
    # usually it returns 'mssql+pymssql://...' or 'mssql+pyodbc://...'
    # The app uses pyodbc. SqlServerContainer uses pymssql by default for its own checks?
    # No, get_connection_url() returns: mssql+pymssql://...
    
    # We need to construct a URL that works with pyodbc and the installed driver in dockerfile
    # Driver={ODBC Driver 17 for SQL Server}
    
    host = mssql_container.get_container_host_ip()
    port = mssql_container.get_exposed_port(1433)
    password = mssql_container.password
    user = mssql_container.username # usually 'sa'
    dbname = "sqldb-workflow-prod-ase-01" # was "tempdb"
    
    # Construct sqlalchemy url for pyodbc
    # Note: We need the driver name available on the system running tests.
    # If running locally on linux, it might be "ODBC Driver 17 for SQL Server"
    driver = "ODBC Driver 17 for SQL Server"
    
    connection_url = f"mssql+pyodbc://{user}:{password}@{host}:{port}/{dbname}?driver={driver}&TrustServerCertificate=yes"
    return connection_url

@pytest.fixture(scope="session")
def mock_loome_urls(wiremock_container):
    """Configures environment variables to point to WireMock."""
    host = wiremock_container.get_container_host_ip()
    port = wiremock_container.get_exposed_port(8080)
    base_url = f"http://{host}:{port}"
    
    # Set env vars used by PortalLib and IntegrateLib
    os.environ["LOOME_INTEGRATE_TOKEN_URL"] = f"{base_url}/token"
    os.environ["LOOME_INTEGRATE_API_BASE_URL"] = f"{base_url}/api/v1"
    os.environ["TOKEN_URL"] = f"{base_url}/token"
    os.environ["API_BASE_URL"] = f"{base_url}/portal/api/v1"
    
    # Other required vars
    os.environ["LOOME_INTEGRATE_CLIENT_ID"] = "test-client-id"
    os.environ["LOOME_INTEGRATE_CLIENT_SECRET"] = "test-client-secret"
    os.environ["LOOME_INTEGRATE_DATA_EXPORT_PROJECT_NAME"] = "Test Project"
    os.environ["LOOME_INTEGRATE_EXPORT_TASK_NAME"] = "Test Task"
    os.environ["CLIENT_ID"] = "test-portal-id"
    os.environ["CLIENT_SECRET"] = "test-portal-secret"
    
    return base_url

# -----------------------------------------------------------------------------
# WireMock Stubbing
# -----------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def setup_wiremock_stubs(mock_loome_urls):
    """Registers default stubs in WireMock."""
    admin_url = f"{mock_loome_urls}/__admin/mappings"
    
    # 1. Token Endpoint Stub
    requests.post(admin_url, json={
        "request": {
            "method": "POST",
            "urlPath": "/token"
        },
        "response": {
            "status": 200,
            "jsonBody": {
                "access_token": "test-jwt-token",
                "token_type": "Bearer",
                "expires_in": 3600
            }
        }
    })
    
    # 2. Portal Status Stub
    requests.post(admin_url, json={
        "request": {
            "method": "GET",
            "urlPath": "/portal/api/v1/status"
        },
        "response": {
            "status": 200,
            "jsonBody": {"status": "OK"}
        }
    })

    # 3. Integrate Projects Stub (for startup check)
    requests.post(admin_url, json={
        "request": {
            "method": "GET",
            "urlPath": "/api/v1/Projects/All"
        },
        "response": {
            "status": 200,
            "jsonBody": [
                {"projectName": "Test Project", "projectId": 123}
            ]
        }
    })

    # 4. Custom Apps (GET)
    requests.post(admin_url, json={
        "request": {
            "method": "GET",
            "urlPath": "/portal/api/v1/consumer/customApps"
        },
        "response": {
            "status": 200,
            "jsonBody": [
                {"name": "Imperial College Research Assets", "id": "test-app-id"}
            ]
        }
    })

    # 4b. Custom Apps (POST) - Create new app
    requests.post(admin_url, json={
        "request": {
            "method": "POST",
            "urlPath": "/portal/api/v1/consumer/customApps"
        },
        "response": {
            "status": 200,
            "jsonBody": {"id": "new-test-app-id", "name": "Test Dataset App"}
        }
    })

    # 5. Attribute Types (GET)
    requests.post(admin_url, json={
        "request": {
            "method": "GET",
            "urlPath": "/portal/api/v1/attributetype/all"
        },
        "response": {
            "status": 200,
            "jsonBody": []
        }
    })

    # 6. Entity Types (GET) for define_metadata
    requests.post(admin_url, json={
        "request": {
            "method": "GET",
            "urlPath": "/portal/api/v1/entitytype/nonactivity"
        },
        "response": {
            "status": 200,
            "jsonBody": [
                {"type": "SQL Database", "id": 59, "source": "Imperial College Research Assets"},
                {"type": "REDCap Database", "id": 60, "source": "Imperial College Research Assets"},
                {"type": "Files", "id": 61, "source": "Imperial College Research Assets"}
            ]
        }
    })
    
    # 7. PUT Attributes
    requests.post(admin_url, json={
        "request": {
            "method": "PUT",
            "urlPath": "/portal/api/v1/consumer/customapps/attributes"
        },
        "response": {
            "status": 200,
            "jsonBody": {}
        }
    })
    
    # 8. PUT Entity Types
    requests.post(admin_url, json={
        "request": {
            "method": "PUT",
            "urlPattern": "/portal/api/v1/consumer/customapps/[^/]+/entity-types"
        },
        "response": {
            "status": 200,
            "jsonBody": {}
        }
    })
    
    # 9. Stage Assets
    requests.post(admin_url, json={
        "request": {
            "method": "POST",
            "urlPattern": "/portal/api/v1/consumer/customapps/[^/]+/stage"
        },
        "response": {
            "status": 200,
            "jsonBody": {"executionId": "test-exec-id"}
        }
    })
    
    # 10. Commit Assets
    requests.post(admin_url, json={
        "request": {
            "method": "POST",
            "urlPathPattern": "/portal/api/v1/consumer/customApps/execution/[^/]+/commit"
        },
        "response": {
            "status": 200,
            "jsonBody": "commit-success-id"
        }
    })
    
    # 11. Execution Status
    requests.post(admin_url, json={
        "request": {
            "method": "GET",
            "urlPattern": "/portal/api/v1/consumer/customApps/execution/[^/]+/status"
        },
        "response": {
            "status": 200,
            "jsonBody": {"status": "SUCCESS", "executionId": "test-exec-id"}
        }
    })

# -----------------------------------------------------------------------------
# Database Fixtures
# -----------------------------------------------------------------------------

@pytest.fixture(scope="session")
def db_engine(db_connection_url, mssql_container):
    """Creates a SQLAlchemy engine for the test session."""
    
    # Create the database first by connecting to master
    # We need a separate connection URL for master
    host = mssql_container.get_container_host_ip()
    port = mssql_container.get_exposed_port(1433)
    password = mssql_container.password
    user = mssql_container.username
    driver = "ODBC Driver 17 for SQL Server"
    master_url = f"mssql+pyodbc://{user}:{password}@{host}:{port}/master?driver={driver}&TrustServerCertificate=yes"
    
    master_engine = create_engine(master_url, echo=False)
    try:
        with master_engine.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            # Check if exists to avoid error
            conn.execute(text("IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'sqldb-workflow-prod-ase-01') CREATE DATABASE [sqldb-workflow-prod-ase-01]"))
    except Exception as e:
        print(f"Error creating database: {e}")
    finally:
        master_engine.dispose()

    engine = create_engine(db_connection_url, echo=False)
    
    # Load schema and data from SQL dump
    import re
    # text is already imported globally
    dump_file = os.path.join(os.path.dirname(__file__), "..", "sqldumps", "sqldb-workflow-prod-ase-01-02252026-ALL.sql")
    
    with engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        with open(dump_file, "r", encoding="utf-16") as f:
            content = f.read()
            
        # Split by 'GO' on a separate line (case insensitive)
        batches = re.split(r'^\s*GO\s*$', content, flags=re.MULTILINE | re.IGNORECASE)
        
        for batch in batches:
            if batch.strip():
                try:
                    conn.execute(text(batch))
                    # conn.commit() # Not needed in autocommit mode
                except Exception as e:
                    # Log error but try to continue or fail?
                    # Some dumps have USE [DbName] which might fail if we are in a container and name differs
                    # We are connected to 'tempdb' or 'master' in connection_url fixture?
                    # connection_url uses "tempdb" (or whatever dbname is set to).
                    # If sql script has USE [sqldb-workflow-prod-ase-01], it might fail if that DB doesn't exist
                    # or if we want to use the current DB.
                    # We should probably strip 'USE' statements or just ignore errors on them.
                    print(f"Error executing batch: {str(e)[:200]}")
                    pass

        # Create dummy stored procedure required by the app if not exists
        # We can try to create it, if it exists it handles itself? 
        # Or check if it exists.
        try:
             # Just a simple check or overwrite
             conn.execute(text("CREATE PROCEDURE sprSyncDataSetToPublish AS BEGIN RETURN 0 END"))
             conn.commit()
        except:
             pass

    return engine

from sqlalchemy import event

@pytest.fixture(scope="function")
def db_session(db_engine):
    """
    Yields a database session for each test.
    Rolls back transaction after test to keep DB clean.
    Uses nested transactions (savepoints) to handle session.commit() calls in app.
    """
    connection = db_engine.connect()
    transaction = connection.begin()
    
    # Begin a nested transaction (SAVEPOINT)
    nested = connection.begin_nested()
    
    # If the application calls session.commit(), it will commit the SAVEPOINT.
    # We need to start a new SAVEPOINT so subsequent operations are also in a savepoint (if needed),
    # and importantly, the outer transaction is NOT committed.
    # However, standard session.commit() releases the savepoint.
    # We use an event listener to intercept the commit and restart the savepoint.
    
    session_factory = sessionmaker(bind=connection)
    session = session_factory()

    # Restart savepoint on commit
    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(session, transaction):
        if transaction.nested and not transaction._parent.nested:
            # This logic can be complex. Simpler is to just rely on begin_nested() being active
            # and ensure the session joins it.
            # But simpler approach: just verify connection.begin_nested() works for MSSQL + pyodbc
            # MSSQL supports savepoints.
            pass
            
    # Actually, a simpler pattern for tests that commit:
    # Just let it commit to the transaction, but wrap the WHOLE thing in a ROLLBACK at the end?
    # If session.commit() commits the connection transaction, we can't rollback.
    # Unless we used a nested transaction from the start.
    
    # Let's try the standard nested transaction approach without complex event listeners first,
    # relying on the fact that we yielded a session bound to a nested transaction context?
    # No, session is bound to connection.
    
    # Let's use the event listener approach from SQLAlchemy docs for testing:
    
    @event.listens_for(session, "after_transaction_end")
    def end_savepoint(session, transaction):
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

# -----------------------------------------------------------------------------
# App Client Fixture
# -----------------------------------------------------------------------------

@pytest.fixture(scope="function")
def client(db_session, db_engine, mock_loome_urls):
    """
    Returns a TestClient with overridden dependencies.
    """
    # Import app here to avoid early import issues if needed, 
    # but usually top level is fine if we patch properly.
    from main import app
    
    # Override get_db
    def override_get_db():
        yield db_session
        
    app.dependency_overrides[get_db] = override_get_db
    
    # Patch the global engine used by startup_db_retry
    original_engine = database.engine
    database.engine = db_engine
    
    # We must also patch the SQLALCHEMY_DATABASE_URL in database module 
    # purely for correctness if anything reads it, though engine patch is key.
    
    # Patch API Key in VerifyHeaders module since it's loaded at import time
    from app import VerifyHeaders
    test_api_key = "test-api-key"
    VerifyHeaders._EXPECTED_API_KEY = test_api_key
    
    # Configure client with auth headers
    headers = {
        "X-API-Key": test_api_key,
        "X-UPN": "test.user@example.com"
    }
    
    with TestClient(app, headers=headers) as test_client:
        yield test_client
        
    # Restore (not strictly necessary if scope is function but good practice)
    database.engine = original_engine
    app.dependency_overrides.clear()
