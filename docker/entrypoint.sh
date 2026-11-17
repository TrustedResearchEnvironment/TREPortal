#!/bin/sh
set -e

# Render the nginx config; only these variables are substituted so nginx variables like $host are kept.
export FRAME_ANCESTORS="${FRAME_ANCESTORS:-*}"
export CORS_ALLOW_ORIGIN="${CORS_ALLOW_ORIGIN:-}"
envsubst '${API_KEY} ${ENTRA_TENANT_ID} ${ENTRA_CLIENT_ID} ${FRAME_ANCESTORS} ${CORS_ALLOW_ORIGIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"
