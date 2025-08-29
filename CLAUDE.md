# openproject-mcp — Project Instructions (authoritative)

## Philosophy
- KISS. Minimal diffs. No speculative abstractions.
- Streamable HTTP transport only; never add SSE unless explicitly asked.
- Use OP v3 “forms-first” for create/update; require lockVersion for PATCH.

## Editing Rules
- Default to Plan mode; show the exact file/diff plan before editing.
- Touch as few files as possible; no new scripts unless necessary.
- Remove any temp files you create in the same PR/commit.

## MCP Server Guardrails
- Do not change Authorization handling. Never allow clients to override it.
- Keep CORS tight to ALLOWED_ORIGINS. No wildcards in prod.
- Keep error envelopes: { content[], structuredContent, isError }.

## TLS / Dev
- Always target OP_BASE_URL=https://thisistheway.local.
- If TLS errors appear in wrangler, fix trust store (don’t disable verification).

## Testing
- After TLS is green: run projects.list → types.list(projectId) → wp.create(dryRun) → wp.list → wp.update(stale vs valid lockVersion).
- For attachments: attach a tiny file to a known WP.

## Commit Hygiene
- 1 feature per commit with clear title, context, and acceptance checks.
