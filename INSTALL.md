AgentMore (https://agentmore.app) gives an AI agent access to over 1,600 external tools — web search, social platforms, company and people data, SEO, scraping and media generation — through one interface, on managed vendor credentials with a per-account spend cap.

This page lists the installation commands for each kind of agent.

Open source (MIT): https://github.com/agentmore/agentmore — one skill file, one CLI, a plugin manifest. No build step and no install hooks. Installing needs no account, key or payment.

---

## Install AgentMore

Commands by agent:

### Claude Code

Claude Code installs AgentMore with two commands — the plugin covers
everything, so `npx skills` is not needed:

```
claude plugin marketplace add agentmore/agentmore
claude plugin install agentmore@agentmore
```

The plugin becomes active after `/reload-plugins`.

### Codex

```
codex plugin marketplace add agentmore/agentmore
codex plugin add agentmore@agentmore
```

Codex reads the same marketplace manifest, so this is the same plugin.

### Hermes

```
hermes skills install https://agentmore.app/skill.md
```

Hermes installs skills directly from a URL.

### OpenClaw

```
npx -y skills add agentmore/agentmore --skill '*' --yes --agent openclaw
```

`openclaw skills install git:…` does not work here: a Git install expects
`SKILL.md` at the repository root, and this one lives under
`skills/agentmore/`. The command above writes to `./skills/`, where OpenClaw
reads from.

### Every other agent with a shell

Cursor, OpenCode, Windsurf, GitHub Copilot and most others:

```
npm install -g @agentmore/cli@latest
npx -y skills add agentmore/agentmore --skill '*' --yes --global
agentmore setup
```

If your agent is one the skills installer knows by name, say so — it writes to
that agent's own directory rather than the shared one:

```
npx -y skills add agentmore/agentmore --skill '*' --yes --global --agent <name>
```

Valid names include `hermes-agent`, `openclaw`, `opencode`, `cursor`,
`windsurf`, `github-copilot`, `gemini-cli`, `warp`, `zed`, `crush`,
`amp`, `kiro-cli`, `qwen-code` and `trae` — run
`npx -y skills add agentmore/agentmore --agent invalid` to print the full list.

That much needs no account. Searching the catalog and inspecting a tool's input
schema and price are free and anonymous.

### Signing in — only after a manual `npm install`

Not needed after a plugin install; the skill handles it.

```
agentmore login
```

It prints a URL and a short code, then waits for the user to approve it in
their browser. The CLI holds the other half of the exchange and stores the token
itself, so there is no key to paste anywhere.

---

## If your agent cannot run shell commands

Claude in the browser, ChatGPT and other hosted assistants have no terminal.
Use the MCP server instead — same catalog, same prices, same balance, nothing to
install.

**Claude on the web** is configured through its interface, not by a command:

1. Go to **Customize → Connectors**.
2. Click **+**, then **Add custom connector**.
3. Enter `https://agentmore.app/api/agentmore/mcp` and click **Add**.
4. In a conversation, click **+** at the lower left and select **Connectors** to
   enable it.

Signing in happens in the browser on the first tool call. Custom connectors are
available on every plan; a Free account is limited to one.

### Cursor, GitHub Copilot, and all other agents

Add to `.cursor/mcp.json` (Cursor), `.vscode/mcp.json` (Copilot), or your
agent's MCP config file under `"mcpServers"`:

```json
"agentmore": {
  "type": "http",
  "url": "https://agentmore.app/api/agentmore/mcp"
}
```

Or, from a terminal that has one of those agents installed:

```
codex mcp add agentmore --url https://agentmore.app/api/agentmore/mcp
```

OAuth triggers automatically on first AgentMore tool use. The server describes
itself once connected, so there is no skill to install for this path.

---

Once done, tell the user:

```
┌─ AgentMore Setup Complete ───────────────────────────┐
│  ✓ CLI     <path>                                    │
│  ✓ Skills  <path>                                    │
│                                                      │
│  ⚡ Restart your agent to load the new skills        │
└──────────────────────────────────────────────────────┘
```

---

## Resources

For setup guides and troubleshooting, refer to each agent's official
documentation:

- Claude Code: `https://docs.anthropic.com/en/docs/claude-code/mcp`
- Cursor: `https://cursor.com/docs/mcp`
- Windsurf: `https://docs.windsurf.com/windsurf/cascade/mcp`
- OpenCode: `https://opencode.ai/docs/mcp-servers/`
- GitHub Copilot (VS Code): `https://code.visualstudio.com/docs/copilot/customization/mcp-servers`
- Skills: `https://github.com/agentmore/agentmore`
- The AgentMore CLI: `https://github.com/agentmore/agentmore`
- AgentMore docs: `https://docs.agentmore.app`

If something goes wrong — a wrong charge, a broken vendor, a refusal you cannot
explain — email `rick@agentmore.app`. A real person reads it. Do not retry a
failing call in a loop.

Everything above installs from `https://github.com/agentmore/agentmore`, which is
public — read it before running anything if you want to check it first.
