#!/bin/sh
# Одноразовая (но безопасно перезапускаемая) настройка Garage: layout
# кластера из одного узла, ключ доступа и бакет с правами на него. Без этого
# свежий узел Garage просто отклоняет все S3-запросы ("NO ROLE ASSIGNED").
# Запускается как отдельный сервис в infra/docker-compose.yml с
# network_mode: service:storage — делит netns и volumes с "storage",
# поэтому CLI обращается к нему как к самому себе (аналог docker exec),
# без плясок с --rpc-host/node-id.
set -e

: "${GARAGE_KEY_ID:?GARAGE_KEY_ID не задан}"
: "${GARAGE_SECRET_KEY:?GARAGE_SECRET_KEY не задан}"
: "${GARAGE_BUCKET:?GARAGE_BUCKET не задан}"

echo "[garage-init] waiting for garage RPC..."
until garage status >/dev/null 2>&1; do
  sleep 1
done
echo "[garage-init] garage is reachable."

if garage status 2>/dev/null | grep -q "NO ROLE ASSIGNED"; then
  NODE_ID=$(garage status 2>/dev/null | awk '/NO ROLE ASSIGNED/{print $1; exit}')
  echo "[garage-init] assigning layout to node $NODE_ID..."
  garage layout assign -z dc1 -c 1G "$NODE_ID"
  CURRENT_VERSION=$(garage layout show 2>/dev/null | sed -n 's/.*layout version: \([0-9]*\).*/\1/p')
  NEXT_VERSION=$((CURRENT_VERSION + 1))
  garage layout apply --version "$NEXT_VERSION"
  echo "[garage-init] layout applied (version $NEXT_VERSION)."
else
  echo "[garage-init] layout already assigned, skipping."
fi

if garage key list 2>/dev/null | grep -q "$GARAGE_KEY_ID"; then
  echo "[garage-init] access key already exists, skipping."
else
  echo "[garage-init] importing access key..."
  garage key import "$GARAGE_KEY_ID" "$GARAGE_SECRET_KEY" --yes
fi

if garage bucket list 2>/dev/null | grep -q "$GARAGE_BUCKET"; then
  echo "[garage-init] bucket already exists, skipping."
else
  echo "[garage-init] creating bucket..."
  garage bucket create "$GARAGE_BUCKET"
fi

echo "[garage-init] ensuring bucket permissions..."
garage bucket allow --read --write --owner "$GARAGE_BUCKET" --key "$GARAGE_KEY_ID"

echo "[garage-init] done."
