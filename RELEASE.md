# Release Procedure

Date: 2025-08-30
Current Version: 3.3.0

This document captures the lightweight packaging / publication steps for internal private release of the OpenProject MCP server.

## 1. Pre-Flight Checklist
- [x] Version bumped in `package.json` and `src/constants/version.ts`
- [x] CHANGELOG entry added for 3.3.0 (Keep a Changelog format)
- [x] README header & security section updated to 3.3.0
- [x] SECURITY-CHECKLIST reflects new controls (RBAC, abort timeouts, HTTPS enforcement)
- [x] TypeScript build passes (`npm run build`)
- [x] Security tests added (HMAC, RBAC, rate limit, input guards)

## 2. Optional Sanity Commands
```bash
npm run lint
npm test               # Skips live tests if server not running
npm run health         # Quick MCP health tool check (requires dev server)
```

## 3. Tag & Push (Private Repo)
```bash
git add .
git commit -m "chore(release): 3.3.0 security + rbac + abort timeouts"
git tag -a v3.3.0 -m "3.3.0: RBAC scopes, HTTPS enforcement, abortable tool execution, cache improvements"
git push origin main --tags
```

## 4. Deployment (Cloudflare Workers)
```bash
npm run deploy
```
Ensure new/changed env vars are set:
- MCP_TOOL_SCOPES (if adopting RBAC)  e.g. {"*": ["read"], "reports.earnedValue": ["analytics"]}
- OP_ALLOW_INSECURE_HTTP (ONLY for local non‑TLS dev) set to true if needed

## 5. Post-Deployment Validation
```bash
# Capabilities
curl -s -X POST $MCP_URL/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"system.getCapabilities","arguments":{}}}' | jq

# Metrics
curl -s -X POST $MCP_URL/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"system.getMetrics","arguments":{}}}' | jq
```
Confirm metrics counters increment on a test tool call and that `scope_denied` stays at 0 (unless intentionally testing).

## 6. Rollback Strategy
If an issue arises, re‑deploy previous tag:
```bash
wrangler deploy --branch v3.2.0
```
(or checkout commit hash then deploy)

## 7. Next Target Items (Not in 3.3.0)
- Distributed rate limiting + nonce storage
- Timeout simulation test harness
- Persistent metrics export (Prometheus / push gateway)
- Additional portfolio analytics tooling

---
Generated 2025-08-30 for internal distribution.
