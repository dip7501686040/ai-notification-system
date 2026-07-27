#!/usr/bin/env bash
# Seeds a realistic, client-demo-ready dataset against a running local
# stack (docker compose up), covering every service: two tenants (to
# show multi-tenancy + RBAC), templates, rules, events, notifications
# (success/failure/retry), an API key, and AI analysis via the local
# Ollama model. Safe to read top-to-bottom as a script-form walkthrough
# of the platform's write paths -- see docs/demo-walkthrough.md for the
# narrative version.
#
# Not fully idempotent: re-running will fail on unique-constrained
# resources (tenant slugs, template names). Intended to be run once
# against a fresh stack, or adapted per-line as needed.
set -euo pipefail

API=${API_URL:-http://localhost:8000}

echo "== Registering demo users =="
OWNER1_EMAIL="demo-owner1-$(date +%s)@example.com"
OWNER2_EMAIL="demo-owner2-$(date +%s)@example.com"
PASSWORD="Password123!"

TOK1=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$OWNER1_EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Demo Owner One\"}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")

TOK2=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$OWNER2_EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Demo Owner Two\"}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")

USER1_ID=$(curl -s "$API/auth/me" -H "Authorization: Bearer $TOK1" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

echo "== Creating Tenant 1 (owner: $OWNER1_EMAIL) =="
SLUG_SUFFIX=$(date +%s)
TENANT1=$(curl -s -X POST "$API/tenants" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"name\":\"Acme Support\",\"slug\":\"acme-support-$SLUG_SUFFIX\"}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

echo "== Creating Tenant 2 (owner: $OWNER2_EMAIL), inviting Tenant 1's owner as a member =="
TENANT2=$(curl -s -X POST "$API/tenants" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK2" \
  -d "{\"name\":\"Globex Freight Co\",\"slug\":\"globex-freight-$SLUG_SUFFIX\"}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

curl -s -X POST "$API/tenants/$TENANT2/members" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK2" \
  -d "{\"userId\":\"$USER1_ID\",\"role\":\"member\"}" > /dev/null

echo "== Tenant 1: templates =="
curl -s -X POST "$API/templates" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"name\":\"Critical Incident Webhook\",\"channel\":\"webhook\",\"body\":\"{\\\"eventType\\\":\\\"{{eventType}}\\\",\\\"source\\\":\\\"{{source}}\\\",\\\"severity\\\":\\\"{{severity}}\\\",\\\"message\\\":\\\"{{message}}\\\"}\"}" > /dev/null
curl -s -X POST "$API/templates" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"name\":\"Critical Incident Email\",\"channel\":\"email\",\"subject\":\"[{{severity}}] {{eventType}} incident\",\"body\":\"Source: {{source}}\\nMessage: {{message}}\"}" > /dev/null

echo "== Tenant 1: rules =="
# Two webhook targets on purpose: httpbin.org succeeds, the unroutable
# IP times out after ~8s and lands in "retrying"/"failed" -- gives the
# demo a real success/failure/retry mix to show in Analytics and the
# Observability dashboards, without sending real email.
curl -s -X POST "$API/rules" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"name\":\"Server Down Alert\",\"eventType\":\"server.down\",\"conditions\":{\"op\":\"equals\",\"field\":\"severity\",\"value\":\"critical\"},\"actions\":[{\"channel\":\"webhook\",\"target\":\"https://httpbin.org/post\",\"template\":\"Critical Incident Webhook\"},{\"channel\":\"webhook\",\"target\":\"http://10.255.255.1/unreachable\",\"template\":\"Critical Incident Webhook\"}]}" > /dev/null
curl -s -X POST "$API/rules" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"name\":\"Payment Failed Alert\",\"eventType\":\"payment.failed\",\"conditions\":{},\"actions\":[{\"channel\":\"webhook\",\"target\":\"https://httpbin.org/post\",\"template\":\"Critical Incident Webhook\"}]}" > /dev/null
curl -s -X POST "$API/rules" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"name\":\"Catch-all Dashboard Feed\",\"eventType\":\"*\",\"conditions\":{},\"actions\":[{\"channel\":\"dashboard\",\"target\":\"$OWNER1_EMAIL\"}]}" > /dev/null

echo "== Tenant 1: AI config -> local Ollama (no API key needed) =="
curl -s -X PUT "$API/ai-config" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"provider\":\"ollama\",\"model\":\"qwen2.5:0.5b\"}" > /dev/null

echo "== Tenant 1: API key =="
curl -s -X POST "$API/apikeys" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"name\":\"CI/CD Ingest Key\",\"rateLimit\":100}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('API key (save this now, shown once):', d['rawKey'])"

echo "== Tenant 1: events (drives rules, notifications, analytics, AI analysis, audit log) =="
curl -s -X POST "$API/events" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"type\":\"server.down\",\"source\":\"prod-db-01\",\"payload\":{\"severity\":\"critical\",\"message\":\"Primary database connection pool exhausted\"}}" > /dev/null
curl -s -X POST "$API/events" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"type\":\"server.down\",\"source\":\"prod-web-03\",\"payload\":{\"severity\":\"warning\",\"message\":\"High memory usage detected\"}}" > /dev/null
curl -s -X POST "$API/events" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"type\":\"payment.failed\",\"source\":\"stripe-webhook\",\"payload\":{\"severity\":\"critical\",\"message\":\"Card declined: insufficient funds\"}}" > /dev/null
curl -s -X POST "$API/events" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"type\":\"user.signup\",\"source\":\"web-app\",\"payload\":{\"severity\":\"info\",\"message\":\"New user registered\"}}" > /dev/null
curl -s -X POST "$API/events" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK1" \
  -d "{\"tenantId\":\"$TENANT1\",\"type\":\"deployment.completed\",\"source\":\"ci-cd\",\"payload\":{\"severity\":\"info\",\"message\":\"v2.4.1 deployed to production\"}}" > /dev/null

echo "== Tenant 2: template + rule + events (separate, isolated dataset) =="
curl -s -X POST "$API/templates" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK2" \
  -d "{\"tenantId\":\"$TENANT2\",\"name\":\"Shipment Delay Webhook\",\"channel\":\"webhook\",\"body\":\"{\\\"shipmentId\\\":\\\"{{shipmentId}}\\\",\\\"status\\\":\\\"{{eventType}}\\\",\\\"note\\\":\\\"{{message}}\\\"}\"}" > /dev/null
curl -s -X POST "$API/rules" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK2" \
  -d "{\"tenantId\":\"$TENANT2\",\"name\":\"Shipment Delay Alert\",\"eventType\":\"shipment.delayed\",\"conditions\":{},\"actions\":[{\"channel\":\"webhook\",\"target\":\"https://httpbin.org/post\",\"template\":\"Shipment Delay Webhook\"}]}" > /dev/null
curl -s -X POST "$API/events" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK2" \
  -d "{\"tenantId\":\"$TENANT2\",\"type\":\"shipment.delayed\",\"source\":\"logistics-tracker\",\"payload\":{\"shipmentId\":\"SHP-88213\",\"message\":\"Customs clearance delay at port\"}}" > /dev/null
curl -s -X POST "$API/events" -H "Content-Type: application/json" -H "Authorization: Bearer $TOK2" \
  -d "{\"tenantId\":\"$TENANT2\",\"type\":\"shipment.delayed\",\"source\":\"logistics-tracker\",\"payload\":{\"shipmentId\":\"SHP-88245\",\"message\":\"Weather delay - route rerouted\"}}" > /dev/null

echo ""
echo "Done. Log in at the web app as:"
echo "  Tenant 1 owner: $OWNER1_EMAIL / $PASSWORD  (Acme Support -- owner)"
echo "  Tenant 2 owner: $OWNER2_EMAIL / $PASSWORD  (Globex Freight Co -- owner; $OWNER1_EMAIL is a member here)"
echo "Give analytics-service ~20-30s to run AI analysis via Ollama before checking the AI tab."
