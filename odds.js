name: Refresh scores and settle bets

on:
  schedule:
    - cron: "*/5 * * * *"
  workflow_dispatch:

concurrency:
  group: everyone-loses-maintenance
  cancel-in-progress: false

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 8
    steps:
      - name: Run scoped server maintenance
        env:
          MAINTENANCE_URL: ${{ secrets.MAINTENANCE_URL }}
          MAINTENANCE_SECRET: ${{ secrets.MAINTENANCE_SECRET }}
        run: |
          test -n "$MAINTENANCE_SECRET" || (echo "Missing MAINTENANCE_SECRET repository secret" && exit 1)
          URL="${MAINTENANCE_URL:-https://everybody-loses.vercel.app}"
          URL="${URL%/}"
          FAILED=0

          call_maintenance() {
            MODE="$1"
            echo "Calling $URL/api/maintenance?$MODE"
            if ! curl --fail-with-body --show-error --max-time 55 --retry 2 --retry-delay 5 \
              -H "Authorization: Bearer $MAINTENANCE_SECRET" \
              -H "Cache-Control: no-cache" \
              "$URL/api/maintenance?$MODE&fresh=$(date +%s)"; then
              FAILED=1
            fi
            echo
          }

          # Keep the frequently changing events current, discover one third of
          # the 48-hour window each run, then settle from the freshly saved data.
          call_maintenance "mode=refresh"
          BUCKET=$(( ($(date +%s) / 300) % 3 ))
          call_maintenance "mode=discover&offset=$BUCKET"
          call_maintenance "mode=settle"

          exit "$FAILED"
