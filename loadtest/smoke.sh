#!/usr/bin/env bash
# Phase F smoke test -- verifies the main-flow API shapes (same calls the
# k6 setup() makes) before committing to a long k6 run.
#
#   bash loadtest/smoke.sh
# Env: API (default http://localhost:8000)

set -uo pipefail
API="${API:-http://localhost:8000}"
S=$(date +%s)

pyget() { python3 -c "import sys,json
try:
    d=json.load(sys.stdin)
    print(d$1)
except Exception as e:
    sys.stderr.write('parse/keys failed: %s\n' % e); sys.exit(1)"; }

echo "1. POST /auth/register"
REG=$(curl -sS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"smoke-$S@example.com\",\"password\":\"LoadTest123!\",\"name\":\"smoke\"}")
TOK=$(printf '%s' "$REG" | pyget "['accessToken']") || { echo "  raw: $REG"; exit 1; }
USERID=$(printf '%s' "$REG" | pyget "['user']['id']") || { echo "  raw: $REG"; exit 1; }
echo "   token=${TOK:0:14}...  userId=$USERID"

echo "2. POST /tenants"
TEN=$(curl -sS -X POST "$API/tenants" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d "{\"name\":\"smoke\",\"slug\":\"smoke-$S\"}")
TID=$(printf '%s' "$TEN" | pyget "['id']") || { echo "  raw: $TEN"; exit 1; }
echo "   tenantId=$TID"

echo "3. POST /rules"
curl -sS -o /dev/null -w '   -> HTTP %{http_code}\n' -X POST "$API/rules" \
  -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"$TID\",\"name\":\"smoke\",\"eventType\":\"load-test.ping\",\"actions\":[{\"channel\":\"dashboard\",\"target\":\"$USERID\"}],\"enabled\":true}"

echo "4. POST /events   (want 200 or 201; 400 = rule did not match)"
BODY=$(curl -sS -w '\n   -> HTTP %{http_code}\n' -X POST "$API/events" \
  -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"$TID\",\"type\":\"load-test.ping\",\"payload\":{\"ts\":1}}")
echo "$BODY"

echo
echo "5. GET /events/:id status (optional end-to-end peek)"
EID=$(printf '%s' "$BODY" | head -1 | pyget "['id']" 2>/dev/null) || EID=""
if [ -n "$EID" ]; then
  sleep 2
  curl -sS "$API/events/$EID" -H "Authorization: Bearer $TOK" | pyget "['status']" 2>/dev/null || echo "   (could not read status)"
fi
