#!/bin/bash
# Alternates ESPN event backfill and season-stat batches on the shared ESPN lease (bounded, polite).
TOKEN=$(cat D:/Workers/secrets/golf-admin-token); API=https://golf-api.propbetedge.ai/admin/run
STATS="pga:2026 lpga:2026 pga:2025 lpga:2025"
for i in $(seq 1 ${1:-200}); do
  R=$(curl -s -X POST -H "authorization: Bearer $TOKEN" "$API?lane=espn&limit=60&budget=200000" --max-time 290); echo "$(date -u +%H:%M:%S) $i E $R" | cut -c1-330
  sleep 65
  for s in $STATS; do L=${s%%:*}; Y=${s##*:}
    R=$(curl -s -X POST -H "authorization: Bearer $TOKEN" "$API?lane=espn-stats&leagues=$L&seasons=$Y&limit=250" --max-time 290); echo "$(date -u +%H:%M:%S) $i S $s $R" | cut -c1-330
    echo "$R" | grep -q '"status":"complete"' && STATS=$(echo $STATS | sed "s/$s//") || { sleep 65; break; }
  done
done
