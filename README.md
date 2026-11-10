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
| `SQLDB_CONNECTION_STRING` | SQL Server connection string. Accepts the ADO.NET form (`Server=tcp:...;Database=...;User ID=...;Password=...`) or a SQLAlchemy URL. Injected by Azure Container Apps. Export it in your shell for local runs. |
| `ENVIRONMENT` | Set to `prod` to turn off `/docs`, `/redoc` and `/openapi.json`, and to require an Entra ID token on every API call. |
| `API_KEY` | Injected by nginx into every `/api/` request. Clients do not send it. |
| `API_UPN` | Dev-only fallback user, injected by nginx. The API ignores it when `ENVIRONMENT=prod`. |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` | Microsoft Entra ID sign-in. Served to the browser from `/config.json`. Leave blank locally to skip sign-in. |
| `FRAME_ANCESTORS` | Origin allowed to embed the app in an iframe, for example the Loome Portal URL. Defaults to `*`, so set it in prod. |
| `HMAC_KEY` | Secret used to sign dataset column metadata. |
| `TOKEN_URL`, `API_BASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`, `SSL_VERIFY` | Portal API settings. |
| `LOOME_INTEGRATE_*` | Integrate settings, including the project and task names used for imports, exports and approvals. |
| `LOOME_ASSIST_*` | Assist settings. |

Each Portal, Integrate and Assist variable is required at startup. A missing value stops the API with an `EnvironmentError`. Do not commit real secrets. Only `.env.example` is tracked.

## Sign-in with Microsoft Entra ID

The app runs inside the Loome Portal iframe, and Loome does not yet supply the user. Until it does, users sign in with Microsoft and the API reads their UPN from the token.

- The page opens a Microsoft sign-in popup and sends the access token as `Authorization: Bearer` on every API call.
- The API checks the token's signature, issuer, audience, expiry and the `access_as_user` scope. The UPN is the `preferred_username` claim.
- With `ENVIRONMENT=prod` a valid token is required and `X-UPN` is ignored. Otherwise `API_UPN` or a test user is used, so local runs need no sign-in. `/api/health` needs no token.
- The iframe must allow popups (`sandbox` needs `allow-popups`, plus `allow-scripts` and `allow-same-origin`).

### Azure setup

1. In Microsoft Entra ID, create a single-tenant App Registration.
2. Under **Authentication**, add a **Single-page application** redirect URI: `https://<app-host>/auth-redirect.html`.
3. Under **Expose an API**, set the Application ID URI (the default `api://<client-id>` is fine) and add a scope named `access_as_user`.
4. In the manifest, set `accessTokenAcceptedVersion` to `2`.
5. In the Enterprise Application, set **Assignment required** to Yes and assign the allowed users.
6. On the Container App, set `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `FRAME_ANCESTORS` (the Loome origin) and `ENVIRONMENT=prod`. No client secret is needed.
7. Do not turn on the Container App's built-in Authentication. Its redirect login cannot run inside an iframe.
