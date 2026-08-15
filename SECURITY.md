# Security policy

## Reporting a vulnerability

Email **`rick@agentmore.app`** with "security" in the subject. A real person
reads it. Please do not open a public issue for a vulnerability.

Include what you did, what happened, and what you expected.

## Scope

This repository holds **instructions**, not a runtime: markdown skill files and
the MCP server configuration that ships with the Claude Code plugin. It carries
no credentials of ours. So the useful reports here are things like:

- a skill file that could steer an agent into leaking the user's own API key
- a plugin or MCP configuration that points at a host we do not control
- a skill that instructs a destructive or paid action without the confirmation
  that gates it

Findings in the **service** behind it — spend limits, the tool catalog, account
isolation — are in scope for the same address, even though the server is not in
this repository.

## Your API key

`AGENTMORE_API_KEY` is read from your environment and sent only to
`https://agentmore.app` over HTTPS, as a bearer token scoped to tool access. It
cannot read your account data, change your settings, or act as you. Revoke one
at <https://agentmore.app/app/api-keys>.
