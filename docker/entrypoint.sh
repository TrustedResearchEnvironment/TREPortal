#!/bin/sh
set -e

# Render the nginx config; only API_KEY and API_UPN are substituted so nginx variables like $host are kept.
envsubst '${API_KEY} ${API_UPN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"
