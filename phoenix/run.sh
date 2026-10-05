#!/usr/bin/with-contenv bashio

echo "===================================="
echo "Dr. Ronny OS Phoenix startet"
echo "Python Core + API wird geladen..."
echo "===================================="

cd /app

# Automatischer Cache-Buster für Phoenix-Frontend
CACHE_VERSION="$(date +%Y%m%d%H%M%S)"
echo "Phoenix Cache-Version: ${CACHE_VERSION}"

find /app/web -type f \( -name "*.html" -o -name "*.js" \) -exec \
  sed -i -E "s/\\?v=[0-9-]+/?v=${CACHE_VERSION}/g" {} \;

PYTHONPATH=/ python3 -m app.main
