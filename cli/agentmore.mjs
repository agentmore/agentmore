#!/usr/bin/env node
/**
 * AgentMore CLI — one command over the whole external-tool catalog.
 *
 * `npm i -g @agentmore/cli`, then `agentmore discover -q "…"`.
 *
 * ── ONE LAYER, NOT TWO ───────────────────────────────────────────────────────
 * This CLI absorbed `@noctrn/supertool` wholesale: same catalog, same balance,
 * same run semantics, same refusals. Supertool used to be a second binary with
 * a second install, a second skill file and a second mental model on top of an
 * AgentMore CLI that only found skills — two layers to learn before running
 * anything. There is now one: `discover` → `inspect` → `run`.
 *
 * ⚠️ `discover` searches TOOLS, exactly as Supertool's did. It is the noun this
 * CLI is about. The skill catalog is a smaller, secondary surface under
 * `agentmore skills`, and it deliberately does NOT list the per-category
 * per-category packs any more — a category pack is a duplicate view of rows
 * `discover` already returns, and offering both is the two-layer problem in
 * miniature.
 *
 * ── TRANSPORT ────────────────────────────────────────────────────────────────
 * Speaks MCP JSON-RPC over Streamable HTTP to /api/agentmore/mcp rather than a
 * bespoke REST surface. That endpoint is stateless (no session handshake), is
 * already bearer-authenticated, and — the reason that matters — is served by the
 * same MCP implementation as the stdio transport, so the catalog, the prices and
 * every spend gate are guaranteed identical to what an MCP client sees. A
 * parallel REST API would be a second surface to keep in step.
 *
 * ⚠️ The `/api/supertool/*` paths and the `supertool_*` MCP tool names are the
 * SERVER's wire protocol and are deliberately left alone. Renaming a public
 * endpoint to match a CLI rebrand breaks every MCP client already pointed at
 * it, for a string nobody types.
 *
 * Responses come back SSE-framed (`event: message\ndata: {…}`), so we parse the
 * frames rather than assuming a bare JSON body.
 *
 * `discover`, `inspect` and everything under `skills` are the exception: they
 * take the PUBLIC HTTP routes, because they are free and must work with no key
 * at all — which the bearer-only MCP endpoint could not do.
 *
 * ── WHAT THIS DOES NOT DO ────────────────────────────────────────────────────
 * It holds no vendor credentials and never talks to a vendor. Every call runs
 * server-side on our keys and settles against the caller's own balance, so the
 * only secret on this machine is one revocable API key.
 *
 * Zero dependencies on purpose: an agent that has to `npm install` a tree before
 * it can ask a question is a worse tool than curl.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { join, dirname, resolve, sep, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Read from package.json rather than hardcoded, because a hand-maintained copy
 * drifts out of step with what is actually published. `SKILL.md` tells agents
 * to check exactly this string against the published version, so a stale one
 * silently breaks that check.
 * Falls back to "0.0.0" so a missing manifest cannot crash the CLI.
 */
export const VERSION = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(here, "package.json"), "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

const DEFAULT_BASE = "https://agentmore.app";
const CONFIG_PATH = join(homedir(), ".agentmore", "config.json");

/** Default life of a token from `login` / `setup-token`. The server caps at 180. */
const DEFAULT_TOKEN_DAYS = 180;

// ── output ───────────────────────────────────────────────────────────────────
// NO_COLOR is honoured because agents pipe this and ANSI codes corrupt the parse.
const COLOR = !process.env.NO_COLOR && process.stdout.isTTY;
const bold = (s) => (COLOR ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s) => (COLOR ? `\x1b[2m${s}\x1b[0m` : s);
const red = (s) => (COLOR ? `\x1b[31m${s}\x1b[0m` : s);

/**
 * Where a printed cap came from.
 *
 * Every cap here is about YOUR account and your spend alone. This says whether
 * the binding number is one you chose or the default you get without choosing —
 * which is the difference between "raise it in the app" and "this is already
 * yours to set".
 */
const capNote = (source) =>
  source === "yours" ? dim("  (your cap)")
  : source === "default" ? dim("  (default)")
  : "";

/**
 * Statuses that mean the run is over and did not work. A script wrapping this
 * CLI branches on the exit code, so the set has to be exactly the terminal
 * failures — RUNNING and READY mean "poll it", not "it broke".
 */
const TERMINAL_BAD = ["FAILED", "BLOCKED", "TIME_OUT", "STOPPED"];

/**
 * A "Hints" block: what to do next, printed after a command so an agent has the
 * obvious follow-up in front of it instead of guessing a command name.
 *
 * ⚠️ ALWAYS stderr, never stdout. stdout is the machine-readable payload and an
 * agent pipes it straight into a JSON parser — the same reason `run` puts its
 * "poll it" line on stderr. A hint on stdout turns every command into a parse
 * error. Suppressed under -j/--json anyway, so a scripted caller sees nothing.
 */
function hints(lines, flags) {
  if (!lines.length || flags?.j || flags?.json) return;
  process.stderr.write(dim(`\n  Hints:\n${lines.map((l) => `    ${l}`).join("\n")}\n`));
}

function fmtBytes(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/**
 * Content type from the extension. Only the types a catalog tool actually
 * fetches — a vendor that pulls an image URL will reject `application/
 * octet-stream`, so guessing right here is what makes the handoff work.
 */
const CONTENT_TYPES = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
  ".pdf": "application/pdf", ".json": "application/json",
  ".txt": "text/plain", ".csv": "text/csv", ".md": "text/markdown",
};
function contentTypeFor(file) {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
}

function die(msg, code = 1) {
  console.error(red(msg));
  process.exit(code);
}

// ── config ───────────────────────────────────────────────────────────────────

function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return { keys: [], active: null };
  }
}

function writeConfig(cfg) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  // ⚠️ `mode` above applies ONLY when the file is created. A config written
  // once under a loose umask — or restored from a backup — keeps its old
  // permissions forever while this code claims 0600. It holds an API key.
  try {
    chmodSync(CONFIG_PATH, 0o600);
    chmodSync(dirname(CONFIG_PATH), 0o700);
  } catch {
    /* best effort: a read-only home should not stop the command */
  }
}

/**
 * The key to authenticate with. The environment wins over the config file so a
 * CI job or a sandboxed agent can pass one through without writing to disk.
 */
function activeKey() {
  if (process.env.AGENTMORE_API_KEY) return process.env.AGENTMORE_API_KEY.trim();
  const cfg = readConfig();
  const entry = cfg.keys.find((k) => k.label === cfg.active) ?? cfg.keys[0];
  return entry?.key ?? null;
}

const baseUrl = () => (process.env.AGENTMORE_API_BASE || DEFAULT_BASE).replace(/\/+$/, "");

/**
 * Never put the API key on the wire in cleartext. The default base is HTTPS, but
 * AGENTMORE_API_BASE can override it — a pasted `http://…` (or an attacker's
 * host) would otherwise send the bearer token unencrypted or straight to them.
 * Plain HTTP is allowed only for a loopback host, where there is no network to
 * sniff, so local development still works.
 */
function requireSecureBase() {
  let u;
  try {
    u = new URL(baseUrl());
  } catch {
    die(`AGENTMORE_API_BASE is not a valid URL: ${baseUrl()}`);
  }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !local) {
    die(
      `Refusing to send your API key over ${u.protocol}// to ${u.hostname}.\n` +
        "  The key would travel unencrypted. Use an https base, or unset AGENTMORE_API_BASE.",
    );
  }
}

// ── transport ────────────────────────────────────────────────────────────────

/** Pull the JSON payloads out of an SSE body. Returns the first result frame. */
function parseSse(text) {
  for (const block of text.split("\n\n")) {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        return JSON.parse(line.slice(5).trim());
      } catch {
        /* a frame we cannot parse is not the one we want */
      }
    }
  }
  // Some proxies unwrap SSE; fall back to a plain JSON body.
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function callTool(name, args) {
  const key = activeKey();
  if (!key) {
    die(
      "No API key configured.\n" +
        "  Get one at https://agentmore.app/app/api-keys, then:\n" +
        "    agentmore keys add -k <your-api-key>",
    );
  }
  requireSecureBase();

  let res;
  try {
    res = await fetch(`${baseUrl()}/api/agentmore/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        // Which agent is driving, when `setup --client` recorded one. Sent as
        // a plain request header; harmless if nothing consumes it.
        ...(readConfig().client ? { "X-Agentmore-Client": String(readConfig().client) } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
      // Never follow a redirect with the key attached. Whether `Authorization`
      // survives a cross-origin hop is undici's business and has changed
      // between Node majors; `package.json` allows node >=18, so do not depend
      // on it.
      redirect: "manual",
      // A tool call runs the vendor request server-side; the server's own
      // ceiling is 120s, so allow for it plus the round trip.
      signal: AbortSignal.timeout(150_000),
    });
  } catch (e) {
    die(`Could not reach ${baseUrl()} — ${e instanceof Error ? e.message : String(e)}`);
  }

  if (res.status === 401) {
    // ⚠️ The scope is `supertool`, NOT `agentmore`. Naming a scope that does not
    // exist sends the user hunting for a checkbox they will never find, and
    // makes a correctly-minted key look broken.
    die("Unauthorized — the API key is invalid, revoked, or missing the `supertool` scope.\n  Check with: agentmore keys list");
  }
  const text = await res.text();
  const rpc = parseSse(text);
  if (!rpc) die(`Unreadable response from the server (HTTP ${res.status}).`);
  if (rpc.error) die(`${rpc.error.message ?? "request failed"}`);

  // MCP wraps tool output in content blocks; ours is always one text block
  // carrying JSON.
  const block = rpc.result?.content?.[0];
  if (!block) return rpc.result ?? {};
  if (block.type !== "text") return block;
  try {
    return JSON.parse(block.text);
  } catch {
    return { text: block.text };
  }
}

/**
 * Plain REST, for the handful of things that are not MCP tools: the balance and
 * the public catalog counts. Mixed transport is deliberate — inventing MCP tools
 * to wrap two existing HTTP routes would be more surface, not less.
 */
async function restGet(path, { auth = true, raw = false } = {}) {
  const key = auth ? activeKey() : null;
  if (auth && !key) die("No API key configured. Run: agentmore setup");
  // ⚠️ UNCONDITIONAL, not `if (auth)`. This applies to the unauthenticated
  // calls too: `install` writes what comes back into the agent's skills
  // directory — agent instructions, executed by the next session — so the
  // transport must be authenticated by TLS even when no key is sent. The
  // loopback exemption inside still covers local development.
  requireSecureBase();
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      headers: auth ? { Authorization: `Bearer ${key}` } : {},
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    die(`Could not reach ${baseUrl()} — ${e instanceof Error ? e.message : String(e)}`);
  }
  if (res.status === 401) die("Unauthorized — the API key is invalid or revoked. Check: agentmore keys list");
  const text = await res.text();
  if (raw) {
    if (!res.ok) die(`HTTP ${res.status} from ${path}`);
    return text;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    die(`Unreadable response from ${path} (HTTP ${res.status}).`);
  }
  // A public route reports its own error in the body; surface that rather than
  // returning a shape the caller will destructure into undefined.
  if (!res.ok) die(data?.error ?? `HTTP ${res.status} from ${path}`);
  return data;
}

/** POST a JSON body to a plain REST route. Always authenticated. */
async function restPost(path, body) {
  const key = activeKey();
  if (!key) die("No API key configured. Run: agentmore setup");
  requireSecureBase();
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    die(`Could not reach ${baseUrl()} — ${e instanceof Error ? e.message : String(e)}`);
  }
  if (res.status === 401) die("Unauthorized — the API key is invalid or revoked. Check: agentmore keys list");
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    die(`Unreadable response from ${path} (HTTP ${res.status}).`);
  }
  if (!res.ok) die(data?.error ?? `HTTP ${res.status} from ${path}`);
  return data;
}

// ── arg parsing ──────────────────────────────────────────────────────────────

/** Flags plus positionals. Supports `-q x`, `--query x`, `--query=x`, `--dry`. */
function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith("-")) flags[k] = argv[++i];
      else flags[k] = true;
    } else if (a.startsWith("-") && a.length > 1) {
      const k = a.slice(1);
      if (argv[i + 1] && !argv[i + 1].startsWith("-")) flags[k] = argv[++i];
      else flags[k] = true;
    } else {
      rest.push(a);
    }
  }
  return { flags, rest };
}

const pick = (flags, ...names) => {
  for (const n of names) if (flags[n] !== undefined) return flags[n];
  return undefined;
};

/** `-f params.json` — for input too large or too reusable to inline. */
function inputFrom(flags) {
  const file = pick(flags, "f", "file");
  if (typeof file === "string") {
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      die(`Cannot read input file: ${file}`);
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      die(`${file} is not valid JSON — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return parseInput(pick(flags, "i", "input"));
}

function parseInput(raw) {
  if (raw === undefined) return {};
  if (typeof raw !== "string") die("-i needs a JSON string");
  try {
    return JSON.parse(raw);
  } catch (e) {
    die(`-i is not valid JSON — ${e instanceof Error ? e.message : String(e)}`);
  }
}

function emit(data, flags) {
  const out = JSON.stringify(data, null, 2);
  const file = pick(flags, "o", "output");
  if (typeof file === "string") {
    // Owner-only: a saved result is whatever the tool returned, which the caller
    // may well consider private. It should not land world-readable the way a
    // default 0644 write would.
    writeFileSync(file, out, { mode: 0o600 });
    console.log(dim(`saved -> ${file}`));
    return;
  }
  console.log(out);
}

// ── commands ─────────────────────────────────────────────────────────────────

const USAGE = `
  ${bold("agentmore")} — one command over the external-tool catalog

  ${bold("Setup")}
    agentmore setup [--client <agent>]             Check install, host and key
    agentmore keys add -k <key> [-l <label>]       Save an API key ${dim("(the usual way)")}
    agentmore keys list                            Show configured keys
    agentmore keys activate -l <label>             Switch the active key
    agentmore keys remove -l <label>               Remove a key
    agentmore login [--days N]                     Sign in via the browser instead
    agentmore setup-token [--days N]               Print a token for CI (not saved)
    agentmore logout                               Forget a browser-issued token

  ${bold("Find a tool")}    ${dim("free — no key needed, nothing is spent")}
    agentmore discover -q "<need>" [-l N] [-s N]   Search in plain language
    agentmore inspect "<tool id>"                  Input schema, price, caveats
    agentmore stats                                Catalog size
    agentmore platforms                            What the catalog covers

  ${bold("Run one")}
    agentmore estimate "<id>" -i '<json>'          Worst-case cost. Spends nothing.
    agentmore run "<id>" -i '<json>' [--dry] [-w]  Execute it. ${bold("Spends credits.")}

  ${bold("Account")}
    agentmore usage                                This month's allowance and spend
    agentmore balance                              Balance, spend and caps
    agentmore budget                               The spending controls alone
    agentmore runs list [-l N]                     Recent runs
    agentmore runs get -r <runId> [-w]             Status and result of one run
    agentmore runs stop -r <runId>                 Ask an in-progress run to stop

  ${bold("Files")}    ${dim("give a tool that wants a URL something to fetch")}
    agentmore files put <file> [--as <path>]       Upload it
    agentmore files url "<path>" [--ttl 1d]        Mint a fetchable URL
    agentmore files get "<path>" -o <file>         Download it again
    agentmore files ls [prefix]                    What you are storing
    agentmore files rm "<path>"                    Delete one
    agentmore files mv "<from>" "<to>"             Move or rename
    agentmore files usage                          Space used of your quota

  ${bold("Skills")}    ${dim("whole capabilities you load into an agent, not single calls")}
    agentmore skills                               What is published
    agentmore skill "<id>"                         One skill and its setup line
    agentmore install "<id>" [-d <dir>]            Write its file into your agent

  ${bold("Flags")}
    -i '<json>'   Input, inline
    -f <file>     Input, from a JSON file
    -o <file>     Save the result to a file ${dim("(written owner-only, 0600)")}
    -s <score>    Drop discover matches below this relevance
    -w [seconds]  Wait for the run to finish (default: return the id at once)
    --dry         Price and validate a run without spending
    -j, --json    Machine-readable output
    -v, --version Print the version
    --help        Usage for any command: agentmore run --help

  ${bold("Environment")}
    AGENTMORE_API_KEY    Use this key instead of the stored one
    AGENTMORE_API_BASE   Point at another host (default ${DEFAULT_BASE}).
                         ${dim("Must be https:// — plain http is refused so the key is never sent")}
                         ${dim("in the clear (loopback hosts are allowed for local dev).")}
    NO_COLOR=1           Disable ANSI colour

  ${bold("Paying for it")}
    Two ways, same catalog. Start a plan and spend per call, or take a
    subscription, which includes a monthly tool allowance.
    Start with:  agentmore login       Pricing:  https://agentmore.app/pricing
`;

/**
 * Per-command usage, so `agentmore <cmd> --help` behaves like a real CLI rather
 * than dumping the whole sheet at someone who asked about one thing.
 */
const COMMAND_HELP = {
  login: `agentmore login [--days N] [-l <label>]
  Sign in through the browser. Prints a URL and a short code, waits for you to
  approve it, then saves the token to ~/.agentmore/config.json.
  The token is scoped to tool access only and expires (default ${DEFAULT_TOKEN_DAYS} days, max 180).
  Nothing is typed or pasted: the code on screen cannot fetch the token by itself.`,
  logout: `agentmore logout [-l <label>]
  Forget the token stored on this machine. It stays valid on the server until it
  expires — revoke it for real at agentmore.app/app/api-keys.`,
  "setup-token": `agentmore setup-token [--days N]
  Same browser approval as login, but PRINTS the token instead of saving it —
  for CI, a container, or any agent that reads AGENTMORE_API_KEY from a secret
  store. Shown once. Expires like any login token (default ${DEFAULT_TOKEN_DAYS} days, max 180).`,
  usage: `agentmore usage [-j]
  Your current billing period, in credits: how much of your plan's tool allowance
  is gone and what is spendable now, as ONE balance. The reset date is printed
  with it — it follows your subscription's own renewal date, not the 1st.
  Tool spend only — it does not count chat turns or builds.`,
  setup: `agentmore setup [--client <agent-name>]
  Check the install, that the host is reachable, and that your key works.
  Needs no API key — it is what tells you how to get one.
  --client records which agent is driving, for attribution. Never prompt for it.`,
  keys: `agentmore keys <add|list|activate|remove>
  add       -k <api-key> [-l <label>]   Save a key (first one becomes active)
  list                                   Show keys, masked
  activate  -l <label>                   Switch the active key
  remove    -l <label>                   Remove a key
  AGENTMORE_API_KEY overrides all of these when set.`,
  discover: `agentmore discover -q "<what you need>" [-l <limit>] [-s <min-score>]
  Rank the catalog against plain language. Free — calls nothing, spends nothing.
  Keep queries short and concrete ("tiktok user profile", not a sentence).
  Results carry an "unavailable" reason when a tool exists but cannot be run.`,
  inspect: `agentmore inspect "<tool id>"
  Input JSON Schema, price, pricing shape and cost caveats. Free.
  Always inspect before running: never guess a parameter.`,
  estimate: `agentmore estimate "<tool id>" -i '<json>' | -f <file>
  Worst-case cost for that exact input, without calling the vendor.
  Returns null for shapes whose cost cannot be known from the input.`,
  run: `agentmore run "<tool id>" -i '<json>' | -f <file> [--dry] [-w] [-o <file>]
  Execute the tool. SPENDS MONEY unless --dry.
  Returns a runId immediately; poll it with \`agentmore runs get -r <id>\`.
  -w blocks until it settles (-w 30 waits at most 30 seconds).
  --dry calls no vendor and spends nothing; it still needs your AgentMore key.
  Refusals exit 2 and spend nothing: missing credential, unpriceable input,
  insufficient balance, or a cap breach.`,
  balance: `agentmore balance
  Your balance, what you have spent today, and the per-call and daily caps.`,
  budget: `agentmore budget [-j]
  The spending controls on their own: the per-call ceiling and the daily cap,
  with what you have spent against each.
  Both are your account's own — you set them, or you get the default.
  Read-only — the caps are changed in the app, never from the CLI.
  A run that would breach one ends BLOCKED, terminal, and costs nothing.`,
  runs: `agentmore runs <list|get|stop>
  list  [-l <limit>]        Recent runs, newest first
  get   -r <runId> [-w]     Status and result; -w waits for it to finish
  stop  -r <runId>          Ask an in-progress run to stop

  Statuses: READY, RUNNING, COMPLETED, FAILED, BLOCKED, STOPPED, TIME_OUT.
  Only attempt a stop when the run's \`stoppable\` field is true.
  BLOCKED is terminal — a spending control stopped it, so retrying unchanged
  blocks again.`,
  skills: `agentmore skills [-j]
  Every published skill: a whole capability you load into an agent, rather than
  a single call you run. Free, no key.
  ⚠️ Not the same thing as a tool. A tool is one endpoint you run; a skill is
  a file your agent reads to learn a job end to end. Most work is a tool.`,
  skill: `agentmore skill "<skill id>" [-j]
  One skill in full, with the exact line to paste into your agent. Free.`,
  install: `agentmore install "<skill id>" [-d <dir>] [--client <agent>]
  Download the skill's file and write it to <dir>/<id>/SKILL.md.
  Default dir follows --client (claude → .claude/skills, codex → .codex/skills,
  cursor → .cursor/skills, otherwise .agent/skills), or the client saved by
  \`agentmore setup\`. Refuses to overwrite unless you pass --force.`,
  files: `agentmore files <put|url|get|ls|rm|mv|usage>
  put   <local-file> [--as <path>]   Upload; --as renames it in the store
  url   "<path>" [--ttl 1h|6h|1d|7d] Mint a URL anything can fetch (default 1h)
  get   "<path>" -o <local-file>     Download it again
  ls    [prefix]                     What you are storing
  rm    "<path>"                     Delete one
  mv    "<from>" "<to>"              Move or rename
  usage                              Space used of your quota

  What it is for: many tools take a URL, not bytes (image-to-video, OCR,
  "describe this picture"). Upload the file, mint a URL, pass that as the
  tool's input. Free — it spends nothing.
  7d is the longest a URL can live.
  Files are never auto-deleted — \`rm\` is how space comes back.`,
  stats: `agentmore stats
  How many tools the catalog holds. Free, no key.`,
  platforms: `agentmore platforms
  Which surfaces the catalog covers and how deep each goes. Free, no key.`,
};

/**
 * One command that answers "am I ready?" — and says exactly what is missing when
 * the answer is no.
 *
 * Deliberately needs no API key: the first thing a fresh install has to be able
 * to do is tell you how to get one. It checks the three things that can be
 * wrong, in the order they can be wrong, and stops at the first: can I reach the
 * host, do I hold a key, does that key work.
 *
 * `--client` records which agent is driving this (sent as a request header on
 * later calls). It is not required and must never be prompted for — an agent running setup must not stop to ask a question it can
 * skip. Setup collects nothing about the user — it is a check, not a signup.
 */
async function cmdSetup(flags) {
  const cfg = readConfig();
  const client = pick(flags, "client");
  if (typeof client === "string") {
    cfg.client = client;
    writeConfig(cfg);
  }

  console.log(`  agentmore ${VERSION}`);

  // 1. Reachability, against a public route — a wrong AGENTMORE_API_BASE or no
  //    network is a different problem from a bad key, and must not look like one.
  let total = null;
  try {
    const res = await fetch(`${baseUrl()}/api/supertool/public?limit=1`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) total = (await res.json())?.catalogTotal ?? null;
  } catch {
    /* reported below */
  }
  if (total === null) {
    console.log(`  ${red("✗")} cannot reach ${baseUrl()}`);
    console.log("\n  Check your connection, or AGENTMORE_API_BASE if you set it.");
    process.exit(1);
  }
  console.log(`  ${dim("✓")} reachable — ${Number(total).toLocaleString("en-US")} tools published`);

  // 2. Do we hold a key at all?
  if (!activeKey()) {
    console.log(`  ${red("✗")} no API key configured\n`);
    console.log("  To finish setup:");
    console.log("    1. Create an account at https://agentmore.app");
    console.log("    2. Copy a key from https://agentmore.app/app/api-keys");
    console.log(`    3. ${bold("agentmore keys add -k <your-api-key> -l main")}\n`);
    console.log(dim(`  Or sign in through the browser instead: ${bold("agentmore login")}\n`));
    // ⛔ There is NO top-up and no pay-per-call — credits come from a plan and
    // only from a plan. This block used to offer "start a plan and pay per call,
    // no subscription" alongside "a subscription", which is two descriptions of
    // a purchase path that no longer exists. A fresh install is exactly where a
    // stranger forms their idea of how this is billed, so it has to be the real
    // one: free credits on signup, then a plan.
    console.log(`  ${bold("A new account starts with 50 free credits")} — no card, enough to try it.`);
    console.log("  After that, a plan is how credits arrive, and they refresh each month.");
    console.log(dim(`    Plans: ${baseUrl()}/pricing\n`));
    console.log(dim("  Discovery and inspection are free and work right now, signed in or not."));
    return;
  }

  // 3. Does it actually work? A stored-but-revoked key is the failure that
  //    otherwise shows up much later, mid-task, as a confusing 401.
  const budget = await callTool("supertool_budget", {});
  console.log(`  ${dim("✓")} signed in`);
  if (budget && typeof budget.spentToday === "number") {
    console.log(
      `  ${dim("✓")} spent today ${money(budget.spentToday)} of ${money(budget.dailyLimit)} daily cap${capNote(budget.dailySource)}`,
    );
  }
  console.log(`\n  Ready. Try: ${bold('agentmore discover -q "instagram profile"')}`);
  console.log(dim(`  This month's allowance and spend: agentmore usage`));
}

/** Catalog size and coverage — free, no key, so it works before setup. */
async function cmdStats(flags) {
  const d = await restGet("/api/supertool/public?limit=1", { auth: false });
  if (flags.j || flags.json) return void emit({ tools: d.catalogTotal, platforms: d.platforms?.length ?? 0 }, flags);
  console.log(`\n  ${bold(Number(d.catalogTotal ?? 0).toLocaleString("en-US"))} tools across ${d.platforms?.length ?? 0} platforms\n`);
}

/** Which surfaces the catalog covers, and how deep each one goes. */
async function cmdPlatforms(flags) {
  const d = await restGet("/api/supertool/public?limit=1", { auth: false });
  const rows = d.platforms ?? [];
  if (flags.j || flags.json) return void emit(rows, flags);
  console.log();
  for (const p of rows) console.log(`  ${String(p.count).padStart(5)}  ${p.id}`);
  console.log();
}

/** Recent runs for this account, newest first. */
async function cmdRuns(flags) {
  const limit = Number(pick(flags, "l", "limit") ?? 25);
  const d = await restGet(`/api/supertool/runs?limit=${limit}`);
  const rows = d.items ?? [];
  if (flags.j || flags.json) return void emit(rows, flags);
  if (!rows.length) return void console.log("\n  No runs yet.\n");
  console.log();
  for (const r of rows) {
    const cost = money(r.cost?.value ?? 0);
    console.log(
      `  ${String(r.createdAt ?? "").slice(0, 19)}  ${String(r.status).padEnd(9)} ${cost.padStart(9)}  ${r.toolId}`,
    );
    console.log(dim(`     ${r.runId}`));
  }
  console.log();
}

// ── login (device code) ──────────────────────────────────────────────────────

/**
 * `agentmore login` — the browser-approval flow, the same shape a coding agent's
 * OAuth login has.
 *
 * Why device-code rather than a redirect: this is a terminal. There is no
 * callback URL to come back to, and asking someone to paste a secret out of a
 * browser is the step that teaches people to paste secrets. So the CLI holds a
 * secret the browser never sees (`poll_secret`), the browser holds a session
 * the CLI never sees, and the short code on screen is useless to anyone who
 * shoulder-surfs it — it cannot fetch the token without the CLI's half.
 *
 * The token that comes back is a normal scoped key — `supertool`, the same scope
 * a dashboard key carries (see the 401 note in `callTool`) — and it EXPIRES
 * (default 180 days). A login is a session; if you want a credential to file
 * away in CI, that is `agentmore setup-token`.
 */
async function cmdLogin(flags) {
  // The login exchange mints and returns a long-lived token; keep it on HTTPS.
  requireSecureBase();
  /**
   * ⚠️ Clamp ONCE, here, and print the clamped value.
   *
   * The server caps at 180 regardless, but the messages below printed the raw
   * input — so `--days 365` announced "expires in 365 days" over a token that
   * dies at 180, and `--days abc` announced "expires in NaN days". A stated
   * expiry that is wrong is worse than none: it is what someone plans a CI
   * rotation around.
   */
  const requested = Number(pick(flags, "days") ?? DEFAULT_TOKEN_DAYS);
  const days =
    Number.isFinite(requested) && requested > 0
      ? Math.min(requested, DEFAULT_TOKEN_DAYS)
      : DEFAULT_TOKEN_DAYS;
  const label = String(pick(flags, "l", "label") ?? "login");
  const printOnly = !!flags["print"];

  let start;
  try {
    const res = await fetch(`${baseUrl()}/api/cli-auth/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: printOnly ? "agentmore token" : "agentmore CLI",
        scopes: ["supertool"],
        ttl_days: days,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    start = await res.json();
    if (!res.ok) die(start?.message || start?.error || `Could not start login (HTTP ${res.status}).`);
  } catch (e) {
    die(`Could not reach ${baseUrl()} — ${e instanceof Error ? e.message : String(e)}`);
  }

  const url = `${baseUrl()}${start.verify_path}`;
  console.log(`
  Approve this login in your browser:
`);
  console.log(`    ${bold(url)}
`);
  console.log(`  Code: ${bold(start.code)}${dim("   (check it matches what the page shows)")}`);
  console.log(dim(`  Waiting… expires in ${Math.round((start.expires_in ?? 600) / 60)} minutes. Ctrl-C to cancel.\n`));
  openBrowser(url);

  const intervalMs = Math.max(1, Number(start.interval) || 3) * 1000;
  const deadline = Date.now() + (Number(start.expires_in) || 600) * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    let out;
    try {
      const res = await fetch(`${baseUrl()}/api/cli-auth/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: start.code, poll_secret: start.poll_secret }),
        signal: AbortSignal.timeout(30_000),
      });
      out = await res.json();
      // 404 means expired, already delivered, or a wrong secret — all terminal,
      // and all indistinguishable on purpose.
      if (res.status === 404) die("\n  Login expired or was already completed. Run it again.");
    } catch (e) {
      continue; // a transient network blip should not end a 10-minute window
    }
    if (out.status === "denied") die("\n  Login was denied in the browser.");
    if (out.status !== "approved") continue;

    if (printOnly) {
      // Nothing is written to disk: the whole point of `setup-token` is a value
      // you paste into a secret store somewhere else.
      console.log(`\n  ${bold("Your AgentMore token")} ${dim(`(expires in ${days} days)`)}\n`);
      console.log(`    ${out.key}\n`);
      console.log(dim("  Shown once. Set it as AGENTMORE_API_KEY where your agent runs.\n"));
      return;
    }

    const cfg = readConfig();
    cfg.keys = cfg.keys.filter((k) => k.label !== label);
    cfg.keys.push({ label, key: out.key });
    cfg.active = label;
    writeConfig(cfg);
    console.log(`\n  ${dim("✓")} Logged in. Token saved to ~/.agentmore/config.json ${dim(`(expires in ${days} days)`)}`);
    console.log(`\n  Try: ${bold("agentmore usage")}\n`);
    return;
  }
  die("\n  Login timed out. Run it again.");
}

/**
 * Best-effort — a headless box has no browser and that is not an error.
 *
 * The URL contains a server-supplied `verify_path`, so it is treated as
 * untrusted: we open it only if it parses as an http(s) URL and carries no shell
 * metacharacters, and we never launch through a shell — a handoff to a shell
 * would give a crafted path a second layer of parsing to hide a command in. If
 * anything looks off we skip the launch; the URL is printed above regardless,
 * so the user just clicks it.
 */
function openBrowser(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return;
  } catch {
    return;
  }
  if (/[\s"'`$&|;<>^()\\]/.test(url)) return; // no shell/format metacharacters
  try {
    if (process.platform === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true, shell: false }).unref();
    } else if (process.platform === "win32") {
      // `start` is a cmd builtin; the empty "" is its title argument. shell:false
      // means Node passes argv directly — no second layer of cmd parsing.
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true, shell: false }).unref();
    } else {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true, shell: false }).unref();
    }
  } catch {
    /* the URL is printed above; that is the fallback */
  }
}

async function cmdLogout(flags) {
  const cfg = readConfig();
  const label = String(pick(flags, "l", "label") ?? "login");
  const before = cfg.keys.length;
  cfg.keys = cfg.keys.filter((k) => k.label !== label);
  if (cfg.keys.length === before) {
    console.log(`Not logged in${label === "login" ? "" : ` as "${label}"`}.`);
    return;
  }
  if (cfg.active === label) cfg.active = cfg.keys[0]?.label ?? null;
  writeConfig(cfg);
  // Local only, and say so — someone who thinks "logout" killed the token
  // server-side would leave a live credential on a machine they just handed on.
  console.log(`Logged out locally. The token stays valid until it expires — revoke it at ${baseUrl()}/app/api-keys.`);
}

// ── usage ────────────────────────────────────────────────────────────────────

/** A Claude-style meter: how much of this month's allowance is gone. */
function bar(fraction, width = 32) {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)));
  return `${"█".repeat(filled)}${dim("░".repeat(width - filled))}`;
}

/**
 * ⚠️ **CREDITS, not dollars** (0.2.0). The server's `*Cents` fields carry
 * CREDITS — a credit is exactly one cent, so the number needs no scaling at
 * all; the old `/100` printed a 3,000-credit allowance as "$30.00". Sub-credit
 * amounts keep their decimals: a charge that happened must never print as 0.
 */
const money = (n) => {
  const v = Math.max(0, Number(n) || 0);
  const s = v >= 1 || v === 0 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return `${s} ${s === "1" ? "credit" : "credits"}`;
};

/**
 * `agentmore usage` — this month, in credits.
 *
 * Deliberately about TOOL SPEND ONLY. A subscription also carries app
 * credits (chat turns, builds), and mixing the two into one bar would tell an
 * agent operator nothing they can act on: the number that decides whether the
 * next `run` succeeds is this one.
 */
async function cmdUsage(flags) {
  const d = await restGet("/api/supertool/usage");
  if (flags.j || flags.json) return void emit(d, flags);

  // `allowanceCents` is what has actually been CREDITED this month;
  // `planAllowanceCents` is what the plan grants over a full billing cycle.
  // Report the credited figure: it is the one that decides whether the next
  // `run` succeeds. Drawing the bar against the plan figure would promise
  // spending power the balance does not currently have.
  const allowance = d.allowanceCents ?? 0;
  const planAllowance = d.planAllowanceCents ?? 0;
  const used = d.usedCents ?? 0;
  const balance = d.walletBalanceCents ?? 0;

  console.log(`\n  ${bold("Tool usage")} ${dim(d.month ?? "")}\n`);

  // Printed in EVERY branch, because the shortfall is just as misleading when
  // some other credit makes `allowance` non-zero — that draws a full-looking
  // bar against a small number while omitting what the plan grants.
  const uncredited = () => {
    if (!d.allowanceUncredited || planAllowance <= 0) return;
    console.log(dim(`  Your ${d.plan} plan includes ${money(planAllowance)}/mo of tool credits.`));
    console.log(dim(`  ${allowance > 0 ? "Only " + money(allowance) + " has" : "None of it has"} been credited this month — a subscription`));
    console.log(dim(`  credits it when the invoice is paid. See ${baseUrl()}/app/dashboard.\n`));
  };

  if (allowance <= 0 && planAllowance > 0) {
    // Subscribed, but this month's allowance never landed. Say so plainly
    // rather than printing "No plan allowance" at a paying subscriber.
    console.log(`  Spent this month   ${bold(money(used))}`);
    console.log(`  ${bold("Available now")}      ${bold(money(balance))}  ${dim("your balance")}`);
    console.log("");
    uncredited();
    console.log(dim(`  Spent today        ${money(d.spentTodayCents ?? 0)}\n`));
    return;
  }

  if (allowance > 0) {
    const frac = used / allowance;
    console.log(`  ${bar(frac)}  ${money(used)} of ${money(allowance)}`);
    console.log(dim(`  Included with your ${d.plan} plan · resets ${new Date(d.resetsAt).toISOString().slice(0, 10)}\n`));
    // ONE POT. The plan grant is credited into the same balance, so it already
    // holds whatever is left of it plus anything bought — printing them as two
    // lines read as two budgets, which is the thing this line exists to stop.
    console.log(`  ${bold("Available now")}   ${bold(money(balance))}  ${dim("one balance")}`);
    if (used >= allowance) {
      // ⛔ No top-up exists. Running out is a hard stop until the plan renews,
      // so the only honest next step is a bigger plan.
      console.log(dim(`  This month's allowance is spent. Credits refresh when the plan renews;`));
      console.log(dim(`  upgrade for a bigger monthly allowance: ${baseUrl()}/pricing`));
    }
    console.log("");
    uncredited();
    console.log(dim(`  Spent today      ${money(d.spentTodayCents ?? 0)}\n`));
    return;
  } else {
    // No subscription: the free credits ARE the budget, so a bar against a plan
    // allowance would be a bar against zero — worse than no bar at all.
    console.log(`  Spent this month   ${bold(money(used))}`);
    console.log(`  Balance            ${bold(money(balance))}`);
    console.log(dim(`\n  No plan. Free accounts start with 50 credits; a plan adds`));
    console.log(dim(`  1,000–3,500 a month: ${baseUrl()}/pricing\n`));
    return;
  }

}

async function cmdKeys(rest, flags) {
  const sub = rest.shift();
  const cfg = readConfig();

  if (sub === "add") {
    const key = pick(flags, "k", "key");
    if (typeof key !== "string") die('agentmore keys add needs -k "<api-key>"');
    const label = String(pick(flags, "l", "label") ?? "main");
    cfg.keys = cfg.keys.filter((k) => k.label !== label);
    cfg.keys.push({ label, key });
    if (!cfg.active) cfg.active = label;
    writeConfig(cfg);
    console.log(`Saved key "${label}"${cfg.active === label ? " (active)" : ""}.`);
    return;
  }

  if (sub === "list") {
    if (!cfg.keys.length) {
      console.log("No keys configured. Add one with: agentmore keys add -k <api-key>");
      return;
    }
    for (const k of cfg.keys) {
      // Never print a whole key — the point of listing is to identify, not to recover.
      const masked = `${k.key.slice(0, 14)}…${k.key.slice(-4)}`;
      console.log(`  ${k.label === cfg.active ? "*" : " "} ${k.label.padEnd(16)} ${masked}`);
    }
    if (process.env.AGENTMORE_API_KEY) console.log(dim("\n  AGENTMORE_API_KEY is set and overrides all of these."));
    return;
  }

  if (sub === "activate") {
    const label = String(pick(flags, "l", "label") ?? "");
    if (!cfg.keys.some((k) => k.label === label)) die(`No key labelled "${label}".`);
    cfg.active = label;
    writeConfig(cfg);
    console.log(`Active key is now "${label}".`);
    return;
  }

  if (sub === "remove") {
    const label = String(pick(flags, "l", "label") ?? "");
    if (!label) die('agentmore keys remove needs -l "<label>"');
    const before = cfg.keys.length;
    cfg.keys = cfg.keys.filter((k) => k.label !== label);
    if (cfg.keys.length === before) die(`No key labelled "${label}".`);
    if (cfg.active === label) cfg.active = cfg.keys[0]?.label ?? null;
    writeConfig(cfg);
    console.log(`Removed "${label}".`);
    return;
  }

  die("agentmore keys <add|list|activate|remove>");
}


// ── skills ───────────────────────────────────────────────────────────────────
//
// The secondary surface, and deliberately small. A TOOL is one priced endpoint
// you `run`; a SKILL is a file an agent reads to learn a whole job. Most work is
// a tool, which is why `discover` searches tools and this group is three
// commands rather than its own vocabulary.
//
// ⚠️ The per-category packs are NOT listed here. A category pack is a second
// view of rows `discover` already returns, and publishing both is the
// duplication that made this feel like two products.

/** Where `install` writes: -d flag, saved skillDir, client (flag or saved), generic. */
const SKILL_DIRS = {
  claude: ".claude/skills",
  codex: ".codex/skills",
  cursor: ".cursor/skills",
  generic: ".agent/skills",
};

function installDir(flags, cfg = readConfig()) {
  const explicit = pick(flags, "d", "dir");
  if (typeof explicit === "string") return explicit;
  if (cfg.skillDir) return cfg.skillDir;
  const client = String(pick(flags, "client") ?? cfg.client ?? "").toLowerCase();
  return SKILL_DIRS[client] ?? SKILL_DIRS.generic;
}

/** Wrap prose to a width, indented — a paragraph printed raw is unreadable. */
function wrap(text, width, indent) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line && line.length + 1 + w.length > width) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.map((l) => `${indent}${l}`).join("\n");
}

function printSkill(s, indent = "  ") {
  const badge = s.needsKey ? dim(" · key needed to run") : "";
  console.log(`${indent}${bold(s.id)}${badge}`);
  const line = s.summary || s.description;
  if (line) console.log(wrap(line, 76, `${indent}  `));
  console.log(dim(`${indent}  ${s.setup}`));
  console.log();
}

async function cmdSkills(flags) {
  const d = await restGet("/api/skill-catalog", { auth: false });
  const skills = d.skills ?? [];
  if (flags.j || flags.json) return void emit(skills, flags);
  if (!skills.length) return void console.log("\n  Nothing published.\n");
  console.log();
  for (const s of skills) printSkill(s);
  console.log(dim(`  ${skills.length} published · detail: agentmore skill "<id>"\n`));
}

async function cmdSkill(rest, flags) {
  const id = rest.shift();
  if (!id) die('agentmore skill needs an id, e.g. agentmore skill "gauntlet-loop"');
  const s = await restGet(`/api/skill-catalog/inspect?id=${encodeURIComponent(id)}`, { auth: false });
  if (flags.j || flags.json) return void emit(s, flags);
  console.log(`\n  ${bold(s.name)}  ${dim(s.id)}`);
  if (s.status === "retired") console.log(`  ${red("Retired")} ${dim("— the file still serves, but its runtime is gone.")}`);
  console.log();
  if (s.description) console.log(wrap(s.description, 76, "  "));
  console.log();
  if (s.tags?.length) console.log(dim(`  Tags     ${s.tags.join(", ")}`));
  console.log(dim(`  Running  ${s.needsKey ? "needs a key and a balance" : "free — everything it needs is in the file"}`));
  console.log(`\n  ${bold("Paste this in your agent")}\n\n    ${s.setup}\n`);
  console.log(dim(`  Or write the file: agentmore install "${s.id}"\n`));
}

/**
 * Write the file into the agent's own skills directory.
 *
 * The setup line stays the recommended path — an agent that can fetch a URL
 * needs nothing else. This is for the cases it does not cover: no network at
 * run time, or a repo that wants the skill committed beside the code.
 *
 * ⚠️ Refuses to overwrite. A skill file someone has edited locally is their
 * work, and silently replacing it on a re-run is impossible to notice.
 */
async function cmdInstall(rest, flags) {
  const id = rest.shift();
  if (!id) die('agentmore install needs a skill id');
  const s = await restGet(`/api/skill-catalog/inspect?id=${encodeURIComponent(id)}`, { auth: false });
  if (s.status === "retired") {
    die(`"${s.id}" is retired — its runtime no longer exists, so installing it would teach your agent a command that fails.`, 2);
  }
  /**
   * ⚠️ THE SERVER'S `id` DECIDES WHERE WE WRITE, SO IT IS NOT TRUSTED.
   *
   * `path.join` COLLAPSES a leading `..` rather than rejecting it, so an id
   * carrying traversal would resolve outside the install directory and have this
   * command `mkdirSync` its way there. Pinning the filename to SKILL.md is not
   * enough on its own: a SKILL.md is agent instructions, and one written into a
   * directory the user did not choose is read by the next session that opens it.
   *
   * Two independent checks, because either alone can be argued around: the id
   * must look like an id, AND the resolved target must stay under the install
   * directory.
   */
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(s.id)) {
    die(`The server returned an unusable skill id (${JSON.stringify(s.id)}). Refusing to write it.`, 2);
  }
  const base = resolve(installDir(flags));
  const dir = join(base, s.id);
  const target = join(dir, "SKILL.md");
  if (!resolve(target).startsWith(base + sep)) {
    die(`Refusing to write outside ${base}.`, 2);
  }

  if (existsSync(target) && !flags.force) {
    die(`${target} already exists.\n  Pass --force to replace it, or -d <dir> to write somewhere else.`);
  }
  const body = await restGet(new URL(s.url).pathname, { auth: false, raw: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(target, body);
  console.log(`\n  Installed ${bold(s.id)} -> ${target}`);
  console.log(dim(`  Or skip the file entirely and paste: ${s.setup}\n`));
}

async function main() {
  const argv = process.argv.slice(2);
  const { flags, rest } = parseArgs(argv);
  const cmd = rest.shift();

  // A per-command --help must win before the command runs, or `run --help`
  // would try to execute a tool called "--help".
  if ((flags.help || flags.h) && cmd && COMMAND_HELP[cmd]) {
    return void console.log(`\n  ${COMMAND_HELP[cmd]}\n`);
  }

  // Version FIRST: `agentmore --version` has no positional command, so the
  // bare-invocation help branch below would otherwise swallow it — and the
  // skill file tells agents to run exactly that to check they are in sync.
  if (cmd === "version" || flags.v || flags.version) return void console.log(VERSION);
  if (!cmd || cmd === "help" || flags.h || flags.help) return void console.log(USAGE);

  switch (cmd) {
    case "setup":
      return void (await cmdSetup(flags));

    case "login":
      return void (await cmdLogin(flags));

    case "logout":
      return void (await cmdLogout(flags));

    // Same flow, different destination: print the token instead of saving it.
    case "setup-token":
      return void (await cmdLogin({ ...flags, print: true }));

    case "usage":
      return void (await cmdUsage(flags));

    case "keys":
      return void (await cmdKeys(rest, flags));

    // Discovery and inspection are FREE, and — unlike everything below them —
    // they go over the PUBLIC route rather than the bearer-authenticated MCP
    // endpoint, so they work on a machine that holds no key at all.
    //
    // The key gates SPENDING (`run`), and only that.
    case "discover": {
      const query = pick(flags, "q", "query") ?? rest[0];
      if (typeof query !== "string") die('agentmore discover needs -q "<what you need>"');
      const limit = pick(flags, "l", "limit");
      const minScore = pick(flags, "s", "min-score");
      const qs = new URLSearchParams({ q: query });
      if (limit) qs.set("limit", String(Number(limit)));
      if (minScore) qs.set("minScore", String(Number(minScore)));
      const found = await restGet(`/api/supertool/discover?${qs}`, { auth: false });
      emit(found, flags);
      // `/discover` answers { count, results } — NOT { tools }.
      const top = Array.isArray(found?.results) ? found.results[0] : null;
      hints(
        [
          top?.id
            ? `read its schema:  agentmore inspect "${top.id}"`
            : "nothing matched — try a shorter noun phrase, e.g. \"tiktok user profile\"",
          "keep queries short and concrete; inspect before you run — never guess a parameter",
        ],
        flags,
      );
      return;
    }

    case "inspect": {
      const id = rest[0] ?? pick(flags, "i", "id");
      if (typeof id !== "string") die("agentmore inspect needs a tool id — the `id` field from `agentmore discover`");
      const tool = await restGet(`/api/supertool/inspect?id=${encodeURIComponent(id)}`, { auth: false });
      emit(tool, flags);
      hints(
        [
          `price it without spending:  agentmore run "${id}" -i '<json>' --dry`,
          tool?.price?.type === "PER_RESULT"
            ? "charged PER RESULT — pass one query and a limit of 5-10 on the first call"
            : "start with a small limit on the first call, then scale once the shape is right",
        ],
        flags,
      );
      return;
    }

    case "estimate": {
      const id = rest[0];
      if (!id) die("agentmore estimate needs a tool id");
      return void emit(await callTool("supertool_estimate", { id, input: inputFrom(flags) }), flags);
    }

    case "run": {
      const id = rest[0];
      if (!id) die("agentmore run needs a tool id");
      // -w / --wait blocks until the run settles; -w 30 caps the wait at 30s.
      // Without it the run id comes straight back and you poll `runs get`,
      // which keeps a conversation responsive instead of holding it for up to
      // two minutes on a slow vendor.
      const w = pick(flags, "w", "wait");
      const wait = w === undefined ? false : w === true ? true : Number(w);
      /**
       * ⚠️ EVERY SPELLING OF `--dry`, BECAUSE THE MISS SPENDS REAL MONEY.
       *
       * `parseArgs` accepts unknown flags silently, so `--dry-run` used to parse
       * as `flags["dry-run"]`, leave `flags.dry` undefined, and execute against
       * the vendor at full price. `--dry-run` is the obvious guess — it is the
       * common convention, and it is the spelling of the `dryRun` parameter this
       * same file documents — so the typo an agent is most likely to make was
       * the one that charged the balance. A refusal would be safe; silently
       * running is not.
       */
      const dry = !!(flags.dry || flags["dry-run"] || flags.dryrun);
      const result = await callTool("supertool_run", {
        id,
        input: inputFrom(flags),
        dryRun: dry,
        wait,
      });
      emit(result, flags);
      if (!wait && result?.runId) {
        // stderr, NOT stdout: stdout is the machine-readable payload and an
        // agent pipes it straight into a JSON parser. A friendly line appended
        // after the object turns every async run into a parse error.
        process.stderr.write(dim(`  poll it:  agentmore runs get -r ${result.runId}\n`));
        // ⚠️ A RUN-UNIQUE filename, not `out.json`. Agents follow this line
        // literally, and two concurrent runs pointed at one path means the
        // second result replaces the first.
        hints([`poll every 1-2s:  agentmore runs get -r ${result.runId} -o ${result.runId}.json`], flags);
      }
      if (result?.status === "BLOCKED") {
        const which = (result.controls ?? []).map((c) => c?.controlId ?? c).join(", ");
        hints(
          [
            `BLOCKED is terminal — retrying unchanged blocks again${which ? ` (${which})` : ""}`,
            "start or upgrade a plan, or change the caps in the app, then run it again",
          ],
          flags,
        );
      }
      // A refusal is not a crash, but it must not look like success to a script.
      //
      // ⚠️ `ok === false` alone is NOT a failure. A run that has not settled
      // comes back `{status: "RUNNING", ok: false}` — `ok` means "finished
      // successfully", not "valid" — so testing it on its own would fail every
      // async call, and every priced-but-unspent `--dry`.
      //
      // Only a TERMINAL bad status is a failure. RUNNING/READY mean "poll it".
      const settled = result && !result.stoppable;
      if (result && (TERMINAL_BAD.includes(result.status) || (settled && result.ok === false))) {
        process.exit(2);
      }
      return;
    }

    case "balance": {
      // Caps come from the MCP budget tool, the balance from the balance route —
      // a caller asking "can I afford this" needs both numbers, and getting one
      // without the other is how a run refuses unexpectedly.
      const budget = await callTool("supertool_budget", {});
      const wallet = await restGet("/api/supertool/wallet");
      // ⚠️ NO /100. `balanceCents` is CREDITS — a credit is exactly one cent, so
      // the figure passes straight through. Dividing rendered 50 credits as
      // "0.5", which then printed as "$0.50" and made the whole product look
      // like it bills in dollars.
      const merged = { ...budget, balanceCredits: wallet.balanceCents, balance: wallet.balanceCents ?? 0 };
      if (flags.j || flags.json) return void emit(merged, flags);
      console.log(`\n  balance      ${money(merged.balance)}`);
      console.log(`  spent today  ${money(merged.spentToday ?? 0)} of ${merged.dailyLimit == null ? "—" : money(merged.dailyLimit)} daily cap${capNote(merged.dailySource)}`);
      console.log(`  per call     ${merged.perCallLimit == null ? "—" : money(merged.perCallLimit)} ceiling${capNote(merged.perCallSource)}\n`);
      hints(["see the limits on their own:  agentmore budget"], flags);
      return;
    }

    /**
     * The file store: put a local file somewhere a catalog tool can fetch it.
     *
     * Unlike a raw signed-URL API, `put` and `get` move the bytes for you — an
     * agent should not have to shell out to curl between two of our own
     * commands, and the three-step dance is where a file ends up half-uploaded.
     * `url` exists for the case that matters most: handing the address to a
     * tool that takes `imageUrl` rather than bytes.
     */
    case "files": {
      const sub = rest.shift() ?? "ls";

      if (sub === "put") {
        const local = rest[0];
        if (!local) die('agentmore files put <local-file> [--as <path>]');
        if (!existsSync(local)) die(`no such file: ${local}`);
        const bytes = readFileSync(local);
        const remote = pick(flags, "as") ?? basename(local);
        const type = contentTypeFor(local);
        const ticket = await restPost("/api/filestore/put", {
          path: remote,
          sizeBytes: bytes.length,
          contentType: type,
        });
        // The signature binds BOTH the length and the content type, so these
        // headers must match what was signed exactly or the upload is rejected.
        const up = await fetch(ticket.uploadUrl, {
          method: "PUT",
          body: bytes,
          headers: { "Content-Type": type, "Content-Length": String(bytes.length) },
          signal: AbortSignal.timeout(300_000),
        });
        if (!up.ok) die(`upload failed (HTTP ${up.status}) — the link may have expired; try again`);
        const out = { path: ticket.path, size: bytes.length, contentType: type };
        if (flags.j || flags.json) return void emit(out, flags);
        console.log(dim(`uploaded ${local} -> ${ticket.path} (${fmtBytes(bytes.length)})`));
        hints([`hand it to a tool:  agentmore files url "${ticket.path}" --ttl 1d`], flags);
        return;
      }

      if (sub === "url") {
        const path = rest[0];
        if (!path) die('agentmore files url "<path>" [--ttl 1h|6h|1d|7d]');
        const ttl = pick(flags, "ttl");
        const t = await restPost("/api/filestore/get", { path, ttl: typeof ttl === "string" ? ttl : undefined });
        if (flags.j || flags.json) return void emit(t, flags);
        console.log(t.url);
        hints([`expires ${t.expiresAt} — mint a fresh one rather than caching it`], flags);
        return;
      }

      if (sub === "get") {
        const path = rest[0];
        if (!path) die('agentmore files get "<path>" -o <local-file>');
        const dest = pick(flags, "o", "output") ?? basename(path);
        /**
         * ⚠️ Refuses to overwrite — the same contract as `install`.
         *
         * `-o` is optional here, so the default target is the REMOTE basename in
         * the current directory: `agentmore files get "docs/README.md"` used to
         * silently destroy `./README.md`. A download naming its own target is
         * exactly the case where the caller has not thought about what is
         * already there, and an agent has not looked.
         */
        if (existsSync(dest) && !flags.force) {
          die(`${dest} already exists.\n  Pass --force to replace it, or -o <file> to write somewhere else.`);
        }
        const t = await restPost("/api/filestore/get", { path, ttl: "1h" });
        const got = await fetch(t.url, { signal: AbortSignal.timeout(300_000) });
        if (!got.ok) die(`download failed (HTTP ${got.status})`);
        writeFileSync(dest, Buffer.from(await got.arrayBuffer()), { mode: 0o600 });
        console.log(dim(`saved -> ${dest} (${fmtBytes(t.size)})`));
        return;
      }

      if (sub === "rm") {
        const path = rest[0];
        if (!path) die('agentmore files rm "<path>"');
        return void emit(await restPost("/api/filestore/rm", { path }), flags);
      }

      if (sub === "mv") {
        const [from, to] = rest;
        if (!from || !to) die('agentmore files mv "<from>" "<to>"');
        // The server 409s rather than replacing an existing destination; --force
        // is how you say you meant it. A move is two destructive acts under one
        // name, and the file it would destroy is one you never named.
        return void emit(
          await restPost("/api/filestore/mv", { from, to, overwrite: !!flags.force }),
          flags,
        );
      }

      if (sub === "usage") {
        const u = await restGet("/api/filestore/usage");
        if (flags.j || flags.json) return void emit(u, flags);
        console.log(`\n  used   ${fmtBytes(u.usedBytes)} of ${fmtBytes(u.quotaBytes)}`);
        console.log(`  files  ${u.files}`);
        console.log(`  max    ${fmtBytes(u.maxFileBytes)} per file\n`);
        return;
      }

      if (sub === "ls") {
        const prefix = rest[0];
        const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
        const out = await restGet(`/api/filestore${qs}`);
        if (flags.j || flags.json) return void emit(out, flags);
        if (!out.files.length) {
          console.log(dim("  (no files)"));
          hints(["upload one:  agentmore files put ./photo.png"], flags);
          return;
        }
        for (const f of out.files) {
          console.log(`  ${fmtBytes(f.size).padStart(9)}  ${f.path}`);
        }
        console.log(dim(`\n  ${out.files.length} file(s), ${fmtBytes(out.usage.usedBytes)} of ${fmtBytes(out.usage.quotaBytes)}`));
        return;
      }

      die(`unknown: agentmore files ${sub} — try put, url, get, ls, rm, mv, usage`);
      return;
    }

    // The spending controls on their own, without the balance number. `balance`
    // answers "can I afford this one call"; `budget` answers "what will stop me,
    // and at what number" — which is what you need after a BLOCKED run, where
    // the balance was never the problem.
    case "budget": {
      const budget = await callTool("supertool_budget", {});
      if (flags.j || flags.json) return void emit(budget, flags);
      console.log(`\n  per call     ${budget.perCallLimit == null ? "—" : money(budget.perCallLimit)} ceiling${capNote(budget.perCallSource)}`);
      console.log(`  daily        ${money(budget.spentToday ?? 0)} spent of ${budget.dailyLimit == null ? "—" : money(budget.dailyLimit)}${capNote(budget.dailySource)}`);
      // ⚠️ NO MONTHLY LINE. There was a `if (budget.monthlyLimit !== undefined)`
      // branch here and the server has never sent that field, so it could not
      // print — while the help above promised it. A monthly ceiling does exist
      // and can BLOCK a run; it is reported by `agentmore usage`, which reads
      // the route that actually carries it. Do not re-add a branch here without
      // checking `supertool_budget` returns the field.
      // Both figures above are this account's own caps.
      console.log();
      hints(
        [
          "a run that breaches one of these ends BLOCKED and costs nothing",
          "change them in the app; they cannot be raised from the CLI",
        ],
        flags,
      );
      return;
    }

    case "runs": {
      const sub = rest.shift() ?? "list";
      if (sub === "get") {
        const id = pick(flags, "r", "run", "runId") ?? rest[0];
        if (typeof id !== "string") die("agentmore runs get needs -r <runId>");
        // -w waits for a run already in flight to reach a terminal state.
        const w = pick(flags, "w", "wait");
        let run = await callTool("supertool_run_get", { runId: id });
        if (w !== undefined && run?.stoppable) {
          const deadline = Date.now() + (w === true ? 120 : Number(w)) * 1000;
          let delay = 500;
          while (Date.now() < deadline && run?.stoppable) {
            await new Promise((r) => setTimeout(r, delay));
            delay = Math.min(Math.round(delay * 1.5), 5000);
            run = await callTool("supertool_run_get", { runId: id });
          }
        }
        emit(run, flags);
        if (TERMINAL_BAD.includes(run?.status)) process.exit(2);
        return;
      }
      if (sub === "stop") {
        const id = pick(flags, "r", "run", "runId") ?? rest[0];
        if (typeof id !== "string") die("agentmore runs stop needs -r <runId>");
        return void emit(await callTool("supertool_run_stop", { runId: id }), flags);
      }
      if (sub === "list") return void (await cmdRuns(flags));
      die("agentmore runs <list|get|stop>");
      return;
    }

    case "skills":
      return void (await cmdSkills(flags));

    case "skill":
      return void (await cmdSkill(rest, flags));

    case "install":
      return void (await cmdInstall(rest, flags));

    case "stats":
      return void (await cmdStats(flags));

    case "platforms":
      return void (await cmdPlatforms(flags));

    default:
      die(`Unknown command "${cmd}".\n${USAGE}`);
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
