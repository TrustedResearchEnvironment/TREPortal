# System Agents & Test Architecture

This document outlines the "Agents" (external systems, services, and actors) that interact with the **TrustAPI** and how they will be represented in the testing environment using `testcontainers` and `pytest`.

## 1. System Under Test (SUT)
*   **TrustAPI**: The FastAPI application handling requests, business logic, and integrations.
    *   **Agent Role**: The primary agent being tested.
    *   **Testing Strategy**: Run as an internal ASGI app within `pytest` (using `TestClient` or `AsyncClient`).

## 2. External Agents (Dependencies)
These are external systems that TrustAPI relies on. In production, these are real services. In testing, they will be simulated using **Testcontainers**.

### A. Database Agent (SQL Server)
*   **Role**: Stores persistent application data (users, requests, metadata).
*   **Production**: Microsoft SQL Server.
*   **Testing**: `testcontainers-python` with a MSSQL image (e.g., `mcr.microsoft.com/mssql/server`).
    *   **Setup**: Spin up container -> Run Alembic migrations -> Seed test data.
    *   **Teardown**: Drop container or rollback transaction.

### B. Loome Integrate Agent (Mocked)
*   **Role**: External integration service for managing Jobs, Projects, and Data Exports.
*   **Interactions**:
    *   Authentication (Get Token).
    *   Get Projects/Jobs.
    *   Create/Run Jobs (Data Access Requests).
*   **Testing**: `testcontainers-python` running a **WireMock** container (or a lightweight Python HTTP server).
    *   **Mock Behavior**: Returns canned JSON responses for:
        *   `POST /token`: Returns valid JWT.
        *   `GET /Projects`: Returns list of projects.
        *   `POST /Jobs`: Simulates job creation.

### C. Loome Portal Agent (Mocked)
*   **Role**: External portal for cataloging and user-facing assets.
*   **Interactions**:
    *   Authentication.
    *   Create/Update Custom Apps.
    *   Define Metadata (Attributes/Entity Types).
    *   Stage and Commit Assets.
*   **Testing**: Same WireMock container as Loome Integrate (different port or path mappings).
    *   **Mock Behavior**: Validates that TrustAPI sends correct JSON schemas for Assets and Metadata.

## 3. Test Actors (Personas)
These "Agents" represent the users or systems invoking the TrustAPI during tests.

### A. Authenticated User (Standard)
*   **Role**: A standard researcher or user.
*   **Headers**: `x-remote-user`, `x-remote-user-id`, `x-remote-user-email`.
*   **Permissions**: Can request access to datasets, list available datasources.

### B. Admin User
*   **Role**: Elevated privileges (if applicable).
*   **Capabilities**: Approve requests, manage configurations.

### C. Unauthenticated/Malicious User
*   **Role**: Tries to access APIs without valid headers or permissions.
*   **Expected Result**: 401/403 errors.

## 4. Testing Tools Agents
*   **Test Runner**: `pytest`.
*   **Container Manager**: `testcontainers`.
*   **Snapshot Engine**: `inline-snapshot` or `syrupy`.
    *   **Role**: Captures the state of API responses and "External Agent" payloads (e.g. what we sent to Loome) to ensure consistency.

## Implementation Plan for Testing
1.  **Fixtures (`conftest.py`)**:
    *   `sql_container`: Starts MSSQL container, yields connection string.
    *   `mock_loome`: Starts WireMock container, returns base URLs.
    *   `db_session`: Connects to `sql_container`, manages transaction rollbacks.
    *   `client`: FastAPI TestClient configured to use `db_session` and mock environment variables.
2.  **Snapshot Testing**:
    *   Use snapshots to verify the JSON payloads sent to Loome and `APIResponse` bodies from TrustAPI.
