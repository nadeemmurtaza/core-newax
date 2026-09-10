# n8n MCP connection

`n8n.newax.co` exposes its built-in **MCP Server** at
`https://n8n.newax.co/mcp-server/http` (Bearer auth). Granted scopes:

```
workflow:read  workflow:write  workflow:execute
execution:read  credential:read
dataTable:read  dataTable:write  project:read  project:write  tag:read
```

That covers the Phase 3 gaps: **execute** the `STORAGE_*` workflows, read
executions, and read the `S3 account` credential to verify its config.

## Config

`.mcp.json` (committed) declares the server and reads the key from
`${N8N_API_KEY}` — the key itself is never in git.

## Provide the API key (pick one)

**A. Env var** — export it before starting Claude Code:

```bash
export N8N_API_KEY='<your n8n API key>'
```

**B. Claude Code local settings** (gitignored):

`.claude/settings.local.json`
```json
{ "env": { "N8N_API_KEY": "<your n8n API key>" } }
```

**C. One-shot, no file** — add the server at local scope with the literal key:

```bash
claude mcp add --transport http --scope local n8n \
  https://n8n.newax.co/mcp-server/http \
  --header "Authorization: Bearer <your n8n API key>"
```

The n8n API key is created in **n8n → Settings → n8n API → Create an API key**.

## Activate

1. Provide the key (above).
2. In Claude Code run `/mcp` → approve the `n8n` server (project `.mcp.json`
   servers need a one-time approval), or restart the session.
3. Tools appear as `mcp__n8n__*`.

## Quick check (optional)

```bash
curl -s -X POST https://n8n.newax.co/mcp-server/http \
  -H "Authorization: Bearer $N8N_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expect a JSON list of tools, not `401`.

## Once connected — what gets unblocked

- Run `STORAGE_REGISTER_ASSET` / `STORAGE_UPLOAD` / `STORAGE_EXPIRE_TEMP` against a
  throwaway tenant uuid and confirm rows/events (`storage.v_storage_overview`).
- Read the `S3 account` credential and confirm endpoint / region / force-path-style.
- Activate `STORAGE_EXPIRE_TEMP` after it passes.
