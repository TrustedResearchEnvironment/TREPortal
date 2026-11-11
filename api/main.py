from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from sqlalchemy.orm import Session
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from PortalLib.CatalogueLib import test_portal_connection
from PortalLib.IntegrateLib import test_integrate_connection
import database
from app import (
    dataset,
    datasource,
    datasourcetype,
    datasourcefieldvalue,
    emailtemplate,
    field,
    metadata,
    request,
    user,
    datasourcefolders,
    datasourcetables,
    datasetfieldvalue,
    datasetcolumns,
    datasetmetadatavalue,
    dataexport,
    dataimport,
    datasetfolderfiles,
    importrequest,
    exportrequest,
    ingestionlog
)
import time
import logging
from sqlalchemy.exc import OperationalError
from database import engine
import os
from fastapi import BackgroundTasks
from app.VerifyHeaders import verify_headers
from app.audit import AuditMiddleware

# Lightweight DB connection retry function
logging.basicConfig(level=logging.INFO)
_logger = logging.getLogger(__name__)
_MAX_RETRIES = 5
_RETRY_DELAY = 2  # seconds

def _startup_db_retry():

    """Database connection retry logic moved to a separate function"""
    # Skip in testing mode - tests use testcontainer fixtures
    if os.getenv("TESTING") == "true":
        _logger.info("Testing mode: skipping database startup checks")
        return
    
    if database.SQLALCHEMY_DATABASE_URL is None:
        _logger.warning("No SQLDB_CONNECTION_STRING configured - skipping DB checks")
        return
    
    _logger.info("Checking database connectivity on startup...")
    _logger.info(f"Database URL: {database.engine.url.render_as_string(hide_password=True)}")
    
    attempts = 0
    while attempts < _MAX_RETRIES:
        try:
            _logger.info(f"Attempt {attempts+1}/{_MAX_RETRIES} to connect to database...")
            
            # Try to get connection details for debugging
            import pyodbc
            _logger.info(f"Available ODBC drivers: {pyodbc.drivers()}")
            
            with engine.connect() as conn:
                # Execute a simple query with timeout
                result = conn.execute(text("SELECT @@version")).scalar()
                _logger.info(f"Database connected successfully. SQL Server version: {result[:30]}...")
                
                # Get more diagnostic info
                db_name_result = conn.execute(text("SELECT DB_NAME() AS CurrentDatabase")).scalar()
                _logger.info(f"Connected to database: {db_name_result}")
                
                # Check if we can query a simple table
                try:
                    table_result = conn.execute(text("SELECT TOP 1 name FROM sys.tables")).scalar()
                    _logger.info(f"Successfully queried tables. First table: {table_result}")
                except Exception as table_exc:
                    _logger.warning(f"Connected to database but couldn't query tables: {str(table_exc)}")
                
            _logger.info("Database connection test completed successfully.")
            return
        except OperationalError as exc:
            attempts += 1
            # Log more details about the exception
            _logger.error(f"Database connection error (attempt {attempts}/{_MAX_RETRIES}): {str(exc)}")
            _logger.error(f"Error type: {type(exc).__name__}")
            
            # Try to extract ODBC specific error details
            if hasattr(exc, 'orig') and exc.orig:
                _logger.error(f"Original error: {str(exc.orig)}")
                if hasattr(exc.orig, 'args') and exc.orig.args:
                    for i, arg in enumerate(exc.orig.args):
                        _logger.error(f"Error detail {i}: {arg}")
            
            if attempts < _MAX_RETRIES:
                _logger.info(f"Waiting {_RETRY_DELAY} seconds before retry...")
                time.sleep(_RETRY_DELAY)
            else:
                _logger.error("Database connection failed after all retries.")
                _logger.error("The application will start, but database-dependent features may not work.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager to handle startup and shutdown events.
    This replaces the deprecated @app.on_event decorators.
    """
    # Startup code
    _logger.info("Application startup ....")
    
    # Skip all startup checks in testing mode - tests control everything via fixtures
    if os.getenv("TESTING") == "true":
        _logger.info("Testing mode: skipping all startup connection checks")
        yield  # Application runs here
        _logger.info("Application shutdown")
        return
    
    if not (os.getenv("ENTRA_TENANT_ID") and os.getenv("ENTRA_CLIENT_ID")):
        raise RuntimeError("ENTRA_TENANT_ID and ENTRA_CLIENT_ID must be set: every API call requires a Microsoft sign-in")

    _logger.info("Testing DB connection...")
    _startup_db_retry()
    _logger.info("DB connection test completed.")

    # do integrate connection test
    _logger.info("Testing Loome Integrate connection on startup...")
    test_integrate_connection()
    _logger.info("Loome Integrate connection test completed.")

    _logger.info("Testing Loome Portal connection on startup...")
    test_portal_connection()
    _logger.info("Loome Portal connection test completed.")
    
    yield  # Application runs here
    
    # Shutdown code
    _logger.info("Application shutdown")
    _logger.info("Application shutting down...")

# Hide the interactive docs and OpenAPI schema when ENVIRONMENT=prod
_IS_PROD = os.getenv("ENVIRONMENT", "").lower() == "prod"

# Create FastAPI app with lifespan
app = FastAPI(
    dependencies=[Depends(verify_headers)],
    lifespan=lifespan,
    docs_url=None if _IS_PROD else "/docs",
    redoc_url=None if _IS_PROD else "/redoc",
    openapi_url=None if _IS_PROD else "/openapi.json",
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return friendly 422 messages, e.g. when a field exceeds its character limit."""
    friendly_errors = []
    for error in exc.errors():
        field_path = " → ".join(str(p) for p in error.get("loc", []) if p != "body")
        error_type = error.get("type", "")
        ctx = error.get("ctx", {})

        if error_type == "string_too_long":
            max_len = ctx.get("max_length", "?")
            msg = f"'{field_path}' is too long — maximum {max_len} characters allowed."
        elif error_type == "string_too_short":
            min_len = ctx.get("min_length", "?")
            msg = f"'{field_path}' is too short — minimum {min_len} characters required."
        elif error_type == "greater_than":
            gt_val = ctx.get("gt", "?")
            msg = f"'{field_path}' must be greater than {gt_val} — zero and negative values are not permitted."
        elif error_type == "greater_than_or_equal":
            ge_val = ctx.get("ge", "?")
            msg = f"'{field_path}' must be {ge_val} or greater."
        elif error_type == "less_than_equal":
            le_val = ctx.get("le", "?")
            le_fmt = f"{le_val:,}" if isinstance(le_val, int) else str(le_val)
            msg = f"'{field_path}' exceeds the maximum allowed value ({le_fmt}) — integer overflow detected."
        else:
            msg = f"'{field_path}': {error.get('msg', 'Invalid value')}."

        friendly_errors.append({"field": field_path, "message": msg})

    return JSONResponse(
        status_code=422,
        content={"detail": friendly_errors},
    )


app.add_middleware(AuditMiddleware)

# Middleware to capture UPN-like headers and attach to request.state for all endpoints
@app.middleware("http")
async def upn_middleware(request: Request, call_next):
    response = await call_next(request)
    return response

# Include routers
app.include_router(dataset.router)
app.include_router(datasource.router)
app.include_router(datasourcetype.router)
app.include_router(datasourcefieldvalue.router)
app.include_router(emailtemplate.router)
app.include_router(field.router)
app.include_router(metadata.router)
app.include_router(request.router)
app.include_router(user.router)
app.include_router(datasourcetables.router)
app.include_router(datasourcefolders.router)
app.include_router(datasetfieldvalue.router)
app.include_router(datasetcolumns.router)
app.include_router(datasetmetadatavalue.router)
app.include_router(dataexport.router)
app.include_router(dataimport.router)
app.include_router(datasetfolderfiles.router)
app.include_router(importrequest.router)
app.include_router(exportrequest.router)
app.include_router(ingestionlog.router)

@app.get("/test-db")
def test_db_connection(db: Session = Depends(database.get_db)):
    try:
        result = db.execute(text('SELECT DB_NAME() AS CurrentDatabase'))
        db_name = result.scalar()
        return {"status": "success", "message": f"Database connection successful. Connected to {db_name}."}
    except Exception as e:
        return {"status": "error", "message": f"Database connection failed: {str(e)}"}

@app.get("/api/health")
def health():
    # Liveness probe for the container healthcheck. Does not touch the database.
    return {"status": "ok"}

@app.get("/")
async def root(request: Request):
    # return the env vars
    # get the callers IP
    client_ip = request.client.host

    return {
        "GITHUB_REPOSITORY": os.getenv("GITHUB_REPOSITORY"),
        "GITHUB_RUN_ID": os.getenv("GITHUB_RUN_ID"),
        "GITHUB_RUN_NUMBER": os.getenv("GITHUB_RUN_NUMBER"),
        "GITHUB_SHA": os.getenv("GITHUB_SHA"),
        "CLIENT_IP": client_ip,
    }

def _restart_process():
    """Helper function to exit the process, allowing the container orchestrator to restart it."""
    time.sleep(1)  # Brief delay to allow the HTTP response to be sent
    os._exit(0)

@app.post("/restart")
async def restart_server(background_tasks: BackgroundTasks):
    """
    Schedules a background task to restart the server process.
    This relies on a container orchestrator (like Docker or Kubernetes)
    to restart the container upon process exit.
    """
    background_tasks.add_task(_restart_process)
    return {"message": "Server is restarting..."}
