# Stage 1: build the static frontend
FROM node:20-alpine AS web-build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: API, nginx and supervisor in one runtime image
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Microsoft ODBC Driver 17 for SQL Server (required by pyodbc), plus nginx, envsubst and supervisor
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg nginx gettext-base supervisor && \
    curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql17 unixodbc-dev && \
    apt-get purge -y --auto-remove curl gnupg && \
    rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default

WORKDIR /app/api

RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    python-multipart \
    python-dotenv \
    pyodbc \
    requests \
    pydantic \
    sqlalchemy \
    PyCap \
    openpyxl \
    pandas \
    certifi \
    nh3 \
    "PyJWT[crypto]"

COPY api/ ./
COPY --from=web-build /app/dist /usr/share/nginx/html
COPY web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/supervisord.conf /etc/supervisor/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN useradd --create-home app && chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
