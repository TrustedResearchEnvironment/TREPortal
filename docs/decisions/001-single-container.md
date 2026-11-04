# 001: Ship the app as one image and one container

Status: accepted (2026-11-04)

## Decision

The frontend and API ship in one Docker image, run as one container.

- Stage 1 builds the Vite static site (`web/`).
- Stage 2 is a Python image with nginx, supervisord, and the ODBC driver. nginx serves the static site on port 80 and proxies `/api/` to uvicorn on `127.0.0.1:8080`.
- supervisord runs both processes and restarts either one if it crashes.
- Compose has one service, `app`. The GitHub Actions workflow builds one image from the repo root and publishes it to GHCR.

Files: [Dockerfile](../../Dockerfile), [docker/supervisord.conf](../../docker/supervisord.conf), [docker/entrypoint.sh](../../docker/entrypoint.sh), [web/nginx.conf.template](../../web/nginx.conf.template), [docker-compose.yml](../../docker-compose.yml).

## Pros

- One image to build, publish, and deploy.
- One Container App with one container. No cross-container or cross-app networking to configure.
- No `API_UPSTREAM` setting. nginx always proxies to localhost.
- Simple local run: `docker compose up` starts one service.

## Cons

- The frontend and API cannot scale or roll back independently.
- A frontend-only change rebuilds and redeploys the API.
- supervisord is an extra moving part. Restarts rely on `autorestart`, and the container only exits if supervisord itself stops.
- The image is larger and includes nginx, the ODBC driver, and the Python stack together.
- Logs from both processes share one container stream, so they are only separated by supervisord program name.

## Revisit when

- Frontend and API need separate deploys or scaling.
- A process crash in the container causes restart problems in production.

If we split later, use two images (or two containers in one app first), and move the nginx upstream into an environment variable, as described in the earlier discussion.

## Open tasks

- REDCap and Folder databases: work out how to connect them to the Portal API for the `Portal - *` catalog endpoints. Decide the connection method, credentials handling, and the endpoint list.
- Rotate the Portal client secret (`Portal - GetToken` catalog entry).
- Commit `DeveloperAPIRequests/AllRequests.json` after approval.
- Decide whether to delete `api/dockerfile` (lowercase, superseded), `db/`, and `api/migrations/`. Compose no longer uses them.
- Frontend: finish the `web/src/api/client.js` operation table, the `web/src/globals.js` Portal fallback, and verify with `npm run build`.
- Local builds: add the user to the `docker` group so `docker compose build` can reach the socket.
- Test the SQL connection through `SQLDB_CONNECTION_STRING` in the container. The health path and `/api/` proxying are verified locally.
