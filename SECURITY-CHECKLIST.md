# Security Checklist - OpenProject MCP Server

## Pre-Commit Security Verification ✅

### 🔐 Secrets and Sensitive Data
- [ ] No `.env` files committed (only `.env.example` allowed)
- [ ] No API keys or tokens in code
- [ ] No private keys (`.key`, `.pem` files) committed
- [ ] No password or secret files committed
- [ ] All sensitive data properly ignored in `.gitignore`

### 📁 Configuration Files
- [ ] `.dev.vars` excluded from version control
- [ ] `.mcp.json` renamed to `.mcp.json.example` (template only)
- [ ] Cloud provider config files (`.aws/`, `.gcloud/`, etc.) excluded
- [ ] Kubernetes configs with secrets excluded

### 🛠️ Development Files
- [ ] `node_modules/` ignored
- [ ] Build outputs (`dist/`, `.wrangler/`) ignored
- [ ] IDE files appropriately handled (`.vscode/` partially ignored)
- [ ] OS files (`.DS_Store`, `Thumbs.db`) ignored

### 🏢 Enterprise Security
- [ ] Security scanning results ignored (`.snyk`, `*-report*.json`)
- [ ] CI/CD logs and artifacts ignored
- [ ] Personal development files appropriately scoped
- [ ] Backup and temporary files ignored

## Files That SHOULD Be Included ✅

### Essential Documentation
- [x] `README.md` - Project documentation
- [x] `CLAUDE.md` - Project instructions for AI agents
- [x] `LESSONS.yaml` - Project learnings and insights
- [x] `CHANGELOG.md` - Version history
- [x] `LICENSE` - Legal requirements

### Configuration Templates
- [x] `.env.example` - Environment configuration template
- [x] `.mcp.json.example` - MCP configuration template
- [x] `caddy-root.crt` - Development TLS certificate (public)

### Project Structure
- [x] Source code (`src/`)
- [x] Tests (`tests/`)
- [x] Package configuration (`package.json`, `package-lock.json`)
- [x] TypeScript configuration (`tsconfig.json`)
- [x] ESLint configuration (`eslint.config.js`)

## Pre-Deployment Security Actions

### 1. Environment Validation
```bash
# Verify no secrets in code
git log --all --grep="password\|secret\|token\|key" --oneline
rg -i "(password|secret|token|api[_-]?key)" --type js --type ts src/

# Check for accidentally committed env files
find . -name "*.env" ! -name "*.env.example" ! -path "*/node_modules/*"
```

### 2. Dependency Security Audit
```bash
# Run security audit
npm audit --audit-level=moderate

# Check for known vulnerabilities
npm run security:check # (if implemented)
```

### 3. Access Control Verification
```bash
# Verify CORS settings are restrictive
grep -r "ALLOWED_ORIGINS" src/
grep -r "\*" src/ | grep -i cors
```

## Incident Response

If sensitive data is accidentally committed:

### Immediate Actions
1. **DO NOT** push to remote repository
2. Remove sensitive data from commit history:
   ```bash
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch PATH/TO/SENSITIVE/FILE' \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. Force push (if remote exists): `git push --force-with-lease`
4. Rotate any exposed credentials immediately

### Prevention
- Use pre-commit hooks for automated scanning
- Regular security training for team members
- Implement automated secret scanning in CI/CD

## Contact Information

**Security Issues:** Report immediately to project maintainers
**Emergency Contact:** [Your security team contact]

---

## Compliance Notes

This project follows enterprise security best practices including:
- OWASP guidelines for secure development
- Industry standard secret management practices  
- Principle of least privilege for access controls
- Defense in depth security architecture

**Last Updated:** $(date)
**Reviewed By:** [Maintainer Name]

---

## Runtime Security Controls (MCP Server v3 Hardening)

The server implements multiple layers of runtime security. Verify these are configured appropriately for deployment:

### Rate Limiting
- Env Vars: `MCP_RATE_LIMIT` (default 200), `MCP_RATE_WINDOW_MS` (default 60000)
- 429 responses include `Retry-After` header in seconds and JSON body with `retryAfterMs`.

### Request Body Limits
- Env Var: `MCP_MAX_BODY_BYTES` (default 524288 = 512KB)
- 413 response on breach: `{ error: 'payload_too_large', limit }`.

### Authentication (Optional)
- Env Var: `MCP_SERVER_TOKEN` enables shared-secret check on all requests via `x-mcp-auth` header.

### Egress Allowlist
- Env Var: `MCP_EGRESS_ALLOW` adds comma-delimited extra hostnames.
- Always allowed: host of `OP_BASE_URL`.
- Disallowed absolute URLs throw `egress_blocked: host <host> not in allowlist` early.

### Tool Execution Timeouts
- Env Var: `MCP_TOOL_TIMEOUT_MS` (default 15000).
- Exceeding timeout raises `tool_timeout: <tool> exceeded <ms>ms`.

### SSE Connection Cap
- Hardcoded current cap: 25 concurrent connections per instance.
- Exceeding returns 429 JSON `{ error: 'too_many_sse_connections' }`.

### Structured Access Logging
- Redacted, minimal fields: `{ e, m, p, ip, s, ms }`.
- No sensitive input arguments logged.

### Input Size / Future Guards (Planned)
- Add specific array length / string length guards for high-volume inputs (filters, lists of IDs) as usage patterns emerge.

### Headers Hardened
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `Permissions-Policy: geolocation=(), camera=(), microphone=()`
- `Cache-Control: no-store`
- Strict CSP for API responses.

### Retry Semantics
- 429 includes `Retry-After` header for client backoff orchestration.

### Open Issues / Next Steps
- Optional HMAC signature for higher-integrity S2S flows.
- IP hashing (salted) for privacy-preserving analytics.
- Centralized distributed rate limit store if multi-instance scaling required.

---