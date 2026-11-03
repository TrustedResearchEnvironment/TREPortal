# TrustAPI
Install:
Fast API

 


Database (LOCAL)
MS SQL server -- manual install
Install SSMS
Polulate: sqldb-worflow-prod-ase-01-180825



Run locally
uvicorn main:app --host 0.0.0.0 --port 8080

Go to : 
http://localhost:8080/docs


Use black extension in VS code to format code

---

## Deployment & CI/CD (GitHub Actions)

When deploying via GitHub Actions or Docker, the following environment variables must be configured to ensure the application connects to the correct services and uses branch-specific settings.

### Required Core Variables
| Variable | Description |
| -------- | ----------- |
| `SQLALCHEMY_DATABASE_URL` | The connection string for the SQL Server database. |
| `TOKEN_URL` | Loome ID Token URL for API authentication. |
| `API_BASE_URL` | Loome Portal API base URL. |
| `CLIENT_ID` | OAuth2 Client ID for Loome API access. |
| `CLIENT_SECRET` | OAuth2 Client Secret for Loome API access. |

### Branch & Environment Specific Variables
These variables allow you to isolate assets and URLs between different branches (e.g., dev vs. prod).

| Variable | Description | Default (if not set) |
| -------- | ----------- | -------------------- |
| `CUSTOM_APP_NAME` | The name of the Loome Portal application. Used to isolate assets per branch/env. | `"TRE Research Assets"` |
| `EMBEDDING_URL_DB` | URL for the Database entity embedding JavaScript file. | *Dev Blob Storage URL* |
| `EMBEDDING_URL_REDCap` | URL for the REDCap entity embedding JavaScript file. | *Dev Blob Storage URL* |
| `APP_TIMEZONE` | Timezone for the application (e.g., "Australia/Sydney"). | `"UTC"` |
| `SSL_VERIFY` | Set to `"true"` to enable SSL verification, `"false"` for dev. | `"true"` |

---

## app/ Directory

| File | Route Prefix | Description |
| ---- | ------------ | ----------- |
| `config.py` | — | App configuration and environment variable loading. |
| `dbtables.py` | — | SQLAlchemy ORM model definitions for all database tables. |
| `helper.py` | — | Shared utilities, primarily `get_paged_result()` for pagination. |
| `VerifyHeaders.py` | — | Middleware dependency that extracts and validates the `x-remote-user` headers for authentication. |
| `datasource.py` | `/api/DataSource` | CRUD for data sources (SQL databases, REDCap, file folders). Includes REDCap metadata sync. |
| `datasourcetype.py` | `/api/DataSourceType` | CRUD for data source types (e.g. SQL Database, REDCap, Files). |
| `datasourcetables.py` | `/api/DataSourceTables` | Read endpoints for table/column metadata belonging to a data source. |
| `datasourcefolders.py` | `/api/DataSourceFolders` | Read endpoints for folder structure belonging to a file-based data source. |
| `datasourcefieldvalue.py` | `/api/DataSourceFieldValue` | Read/write for configuration field values associated with a data source. |
| `dataset.py` | `/api/DataSet` | CRUD for datasets. Also handles submitting a new data access request against a dataset. |
| `datasetcolumns.py` | `/api/DataSetColumns` | Manage dataset column definitions. Includes Excel integrity verification for column uploads. |
| `datasetfieldvalue.py` | `/api/DataSetFieldValue` | Field values (key-value config) attached to a dataset. |
| `datasetmetadatavalue.py` | `/api/DataSetMetaDataValue` | Metadata tag values attached to a dataset. |
| `datasetfolderfiles.py` | `/api/DataSetFolderFile` | Files within dataset folder definitions (used for file-based datasets). |
| `field.py` | `/api/Field` | Read lookup for available fields used in data source configuration. |
| `metadata.py` | `/api/MetaData` | CRUD for metadata definitions (tags/attributes applied to datasets). |
| `emailtemplate.py` | `/api/EmailTemplate` | CRUD for email templates used in approval/rejection notifications. |
| `user.py` | `/api/User` | User management (mostly stubbed; auth is handled via headers). |
| `request.py` | `/api/Request` | **Data export access requests.** Handles the lifecycle of a researcher requesting access to a dataset — create, list (by user/approver/admin), approve, reject, delete. Also exposes Loome Assist Projects for project selection. |
| `dataexport.py` | `/api/DataExport` | **Loome Integrate job management for data exports.** Lists and creates Loome Integrate export jobs via `IntegrateLib`. Deals with the Loome-side job objects (job ID, schedule, executions), not TrustAPI database records. |
| `dataimport.py` | `/api/DataImport` | **Loome Integrate job management for data imports.** Mirror of `dataexport.py` but for import jobs. Lists and creates Loome Integrate import jobs via `IntegrateLib`. Deals with Loome-side job objects only, not TrustAPI database records. |
| `importrequest.py` | `/api/ImportRequest` | **Import access request tracking in the TrustAPI database.** Stores and manages the internal approval workflow records for import requests (status, approval/rejection messages, dates) — analogous to `request.py` but for imports. |

### Key distinction: `dataimport.py` vs `importrequest.py`

| | `dataimport.py` | `importrequest.py` |
| -- | -- | -- |
| **What it talks to** | Loome Integrate (external API) | TrustAPI SQL database |
| **What it manages** | Loome-side import *jobs* (job ID, schedule, last execution) | Internal import *request records* (status, approval workflow, dates) |
| **Analogy** | Same role as `dataexport.py` | Same role as `request.py` |
| **When it's called** | When creating/listing the actual Loome job that moves data | When approving/tracking the governance request for an import |
