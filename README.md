# PublicPortalTemplates
PUBLIC 


<!-- use the example java script -->

## Run locally with Docker

The frontend and API run in one container. nginx serves the site on port 80 and proxies `/api/` to the API.

1. Copy `.env.example` to `.env` and fill in the values. `.env` is git-ignored.
2. Export the database connection string in your shell. It is not read from `.env`:

   ```bash
   export SQLDB_CONNECTION_STRING="mssql+pyodbc://<user>:<password>@<server>.database.windows.net/<database>?driver=ODBC+Driver+17+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no"
   ```

3. Start the stack:

   ```bash
   docker compose up --build
   ```

4. Open `http://localhost:8080`. The health check is `http://localhost:8080/api/health`.

`docker-compose.override.yml` loads automatically in local runs. It points Portal and Integrate at the WireMock stubs in `dev/wiremock/mappings`, and starts a Vite dev server at `http://localhost:5173` with hot reload. Production runs use the base file only: `docker compose -f docker-compose.yml up`.

## Build

- Frontend: `cd web && npm ci && npm run build`. The output goes to `web/dist`, which is generated and not edited by hand.
- Image: `docker build -t treportal .` from the repo root. Stage 1 builds the frontend and stage 2 is the runtime image.
- API tests: `cd api && python3 -m pytest`. The tests start SQL Server and WireMock containers, so Docker must be running.

## Environment variables

All settings are in `.env.example`, with comments on each group.

| Variable | Purpose |
| -------- | ------- |
| `SQLDB_CONNECTION_STRING` | SQLAlchemy connection string for SQL Server. Injected by Azure Container Apps. Export it in your shell for local runs. |
| `ENVIRONMENT` | Set to `prod` to turn off `/docs`, `/redoc` and `/openapi.json`. |
| `API_KEY`, `API_UPN` | Injected by nginx into every `/api/` request. Clients do not send these. |
| `HMAC_KEY` | Secret used to sign dataset column metadata. |
| `TOKEN_URL`, `API_BASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`, `SSL_VERIFY` | Portal API settings. |
| `LOOME_INTEGRATE_*` | Integrate settings, including the project and task names used for imports, exports and approvals. |
| `LOOME_ASSIST_*` | Assist settings. |

Each Portal, Integrate and Assist variable is required at startup. A missing value stops the API with an `EnvironmentError`. Do not commit real secrets. Only `.env.example` is tracked.
