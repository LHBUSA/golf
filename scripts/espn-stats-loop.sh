#!/bin/bash
# Season-stat batches on the ESPN lease (event backfill runs on the Worker cron).
TOKEN=$(cat D:/Workers/secrets/golf-admin-token); API=https://golf-api.propbetedge.ai/admin/run
for s in pga:2026 lpga:2026 pga:2025 lpga:2025; do L=${s%%:*}; Y=${s##*:}
  for i in $(seq 1 40); do
    R=$(curl -s -X POST -H "authorization: Bearer $TOKEN" "$API?lane=espn-stats&leagues=$L&seasons=$Y&limit=200" --max-time 290); echo "$(date -u +%H:%M:%S) $s $i $R" | cut -c1-300
    echo "$R" | grep -q '"status":"complete"' && break
    sleep 40
  done
done
