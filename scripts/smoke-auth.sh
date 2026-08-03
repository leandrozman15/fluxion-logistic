#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://fluxion-logistic-backend.onrender.com}"
TOKEN="${TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "Missing TOKEN environment variable."
  echo "Example: TOKEN=\"$(JWT_SECRET=... node scripts/generate-jwt.mjs)\" bash scripts/smoke-auth.sh"
  exit 1
fi

echo "Base URL: $BASE_URL"

echo
echo "1) /api/health"
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/health" | cat

echo
echo "2) /api/analytics/overview"
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/analytics/overview" | cat

echo
echo "3) /api/analytics/revenue-trend?months=3"
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/analytics/revenue-trend?months=3" | cat

echo

echo "Smoke test completed."
