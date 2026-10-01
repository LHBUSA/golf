#!/bin/bash
# Bounded media-lane batches through the admin route, one lease at a time.
TOKEN=$(cat D:/Workers/secrets/golf-admin-token)
for i in $(seq 1 ${1:-8}); do
  sleep 65
  R=$(curl -s -X POST -H "authorization: Bearer $TOKEN" "https://golf-api.propbetedge.ai/admin/run?lane=media&limit=150" --max-time 290)
  echo "$(date -u +%H:%M:%S) $i $R" | cut -c1-700
  echo "$R" | grep -q '"candidates":0' && break
done
