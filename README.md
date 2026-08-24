# AgentMore skills

Agent skills and the hosted tool server for [AgentMore](https://agentmore.app) —
over 1,600 external tools for search, social data, company and people data, SEO,
scraping and media generation, each with a real input schema and a known price,
behind managed vendor credentials and a per-account spend cap.

Full instructions: **[INSTALL.md](INSTALL.md)** — the same file served at
<https://agentmore.app/agent-setup/prompt.md>, generated from one source so the
two cannot disagree.

**The one thing to do:** paste this into the agent you already use.

```
Fetch and execute the appropriate instructions to set me up for AgentMore from https://agentmore.app/agent-setup/prompt.md
```

It picks the section for your agent and runs the install itself. The rest of
this file is what it does, if you would rather do it by hand.

## Install

### Claude Code

```bash
claude plugin marketplace add agentmore/agentmore
claude plugin install agentmore@agentmore
```

Then `/reload-plugins`. The skill installs the CLI itself the first time it is
used, so there is nothing else to run.

### Codex

```bash
codex plugin marketplace add agentmore/agentmore
codex plugin add agentmore@agentmore
```

Codex reads the same `.claude-plugin/marketplace.json`, so it is the same plugin.

### Hermes

```bash
hermes skills install https://agentmore.app/skill.md
```

### OpenClaw

```bash
npx -y skills add agentmore/agentmore --skill '*' --yes --agent openclaw
```

Not `openclaw skills install git:…` — a Git install expects `SKILL.md` at the
repository root, and ours lives under `skills/agentmore-cli/`.

### Every other agent with a shell

```bash
npm install -g @agentmore/cli@latest
npx -y skills add agentmore/agentmore --skill '*' --yes --global
agentmore login
```

`agentmore login` opens your browser, you approve once, and the CLI stores the
token itself. Nothing to paste.

If your agent has its own skills directory — Hermes (`.hermes/skills`), OpenClaw
(`skills/`) and others — name it so the file lands in the right place:

```bash
npx -y skills add agentmore/agentmore --skill '*' --yes --global --agent hermes-agent
```

### No shell?

Claude in the browser, ChatGPT and other hosted assistants have no terminal.
**Claude on the web:** Customize → Connectors → **+** → **Add custom
connector** → `https://agentmore.app/api/agentmore/mcp`. Then enable it per
conversation with the **+** button.

**Anything whose MCP config is a file:**

```json
{
  "mcpServers": {
    "agentmore": {
      "type": "http",
      "url": "https://agentmore.app/api/agentmore/mcp"
    }
  }
}
```

⚠️ The plugin above deliberately does **not** ship this. Claude Code has a
shell, so it belongs on the CLI path.

## Authentication

**OAuth triggers automatically on first AgentMore tool use.** Your agent opens a
browser, you approve once, and it stores the token itself — there is no key to
copy and no config file to edit.

Approving creates an API key scoped to tool access only. It cannot read your
data, change your settings or act as you, and you can see or revoke it any time
at <https://agentmore.app/app/api-keys>.

**Reading is free and needs no sign-in at all** — searching the catalog,
inspecting a tool's input schema and reading its price are anonymous. You only
authenticate to *run* a tool, because running one spends money. Every new
account starts with $0.50 of free balance.

If you would rather use a long-lived key directly — CI, a container, a headless
box — mint one at the link above and set `AGENTMORE_API_KEY`, or add
`"headers": { "Authorization": "Bearer ..." }` to the config above.

## What's in here

**One skill: `agentmore-cli`** — for reaching the catalog from a shell
(terminal, script, CI, container), at
<https://agentmore.app/agentmore-cli/SKILL.md>.

**There is deliberately no skill for the MCP server.** An MCP server describes
itself: the tool schemas carry the signatures, and the server's `instructions`
reach every client at connect with nothing installed. A skill explaining MCP
would duplicate that and only reach the clients that load skills. A CLI has no
such mechanism, which is why that one exists.

So if you installed the plugin or registered the MCP server, you are done —
there is nothing here you need.

Every one of those URLs serves the exact file in this repository, so an agent
that can fetch a URL needs nothing installed at all.

## Spending

- Discovery and inspection are free. Only running a tool spends.
- Every call is priced **before** it runs. A call whose worst case cannot be
  priced is refused rather than run at an unknown cost.
- The account owner sets a per-call ceiling and a daily cap. A refusal is
  terminal and free — nothing reached a vendor and nothing was charged.
- The vendor credentials are ours and stay server-side. The only secret on your
  machine is one revocable key.

Pricing: <https://agentmore.app/pricing> · Docs: <https://docs.agentmore.app>

## Contributing

This repository is a **read-only mirror**. Its contents are generated from
AgentMore's main tree and republished on every release, so a commit pushed here
is overwritten by the next sync.

Issues and pull requests are still read — a PR is a fine way to show a fix. It
gets applied upstream and lands here on the following sync.

For anything urgent, or a security report, email `rick@agentmore.app`.

## License

MIT — see [LICENSE](LICENSE).

`skills/ui-skills` is derived from [UI Skills](https://github.com/ibelick/ui-skills)
by ibelick, also MIT. Its copyright notice is in [NOTICE](NOTICE).
