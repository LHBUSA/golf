#!/bin/bash
# Repeated bounded results-lane runs through the authenticated admin route (one lease at a time).
TOKEN=$(cat D:/Workers/secrets/golf-admin-token); LANE=${1:-results}; N=${2:-40}
for i in $(seq 1 $N); do
  R=$(curl -s -X POST -H "authorization: Bearer $TOKEN" "https://golf-api.propbetedge.ai/admin/run?lane=$LANE&limit=60&budget=200000" --max-time 290)
  echo "$(date -u +%H:%M:%S) $i $R" | cut -c1-400
  echo "$R" | grep -q '"due":0' && break
  sleep 65
done
