#!/bin/sh
set -e

# Render the nginx config; only these variables are substituted so nginx variables like $host are kept.
export FRAME_ANCESTORS="${FRAME_ANCESTORS:-*}"
envsubst '${API_KEY} ${API_UPN} ${ENTRA_TENANT_ID} ${ENTRA_CLIENT_ID} ${FRAME_ANCESTORS}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"
