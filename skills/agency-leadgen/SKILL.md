---
name: agency-leadgen
version: 0.6.0
description: >-
  Find companies and the people inside them, then enrich, research and qualify
  them into leads. Proactively load this before writing a scraper for company or
  people data, before a generic web fetch for firmographics, before buying a
  list, and before telling anyone a company or a contact cannot be found.
  Use it whenever you need to build a target list from an ICP, find decision
  makers at a company, get a company's employees, enrich a person or a domain,
  find local businesses, spot buying signals like hiring or funding, research a
  prospect's site, stack or posts, score and qualify a list, or hand back
  structured lead rows for whoever is asking. Also matches lead gen,
  leadgen, prospecting, outbound research, ICP, list building, sales
  intelligence and B2B contact data. It reaches these sources through the
  AgentMore catalog, discovering the right endpoint per step rather than using a
  fixed one. It is lead-gen ONLY and bounds its own discovery to that: it looks
  companies and people up on LinkedIn, Instagram, TikTok, X, Facebook, Reddit
  and YouTube, but does not do media, image, video or voice generation, crypto,
  markets, ecommerce, logistics, or social content and growth work, and refuses
  those rather than reaching for them. It also stops before the send: no sending, sequencing, inboxes or
  deliverability. Exception: if the user already has a dedicated MCP server, API
  key, CRM or sales-intelligence seat for that specific service, use theirs —
  this fills the gaps in their stack, it does not replace it.
license: MIT
metadata:
  agentmore:
    tags: [leads, leadgen, prospecting, icp, enrichment, b2b, sales, contacts]
    related_skills: [agentmore]
---

# Lead-gen — find companies, and the people inside them

The job is **research that ends in a list of people worth contacting**: find the
companies, find the people, enrich them, research them, qualify them, hand it
back.

⚠️ **WHO YOU ARE HERE.** You are the lead-research agent. Somebody built you and
installed this skill into you; the person you are talking to is **the user** —
whoever asks you to find leads. The companies and people you find are
**prospects**, and they are the user's prospects, not yours.

That matters because the words are easy to tangle: a "client" in this file means
*the user's* customer, never yours. When the user says "my client", they mean
someone they sell to. You do not have clients.

You reach the data through the AgentMore catalog. One key covers every source
below — no per-vendor signup, no vendor credentials on this machine — and every
call has a known price that settles against one balance.

⚠️ **This file is self-contained.** It carries the whole command surface — the
CLI, discovery, running, polling, refusals, keys and costs — as well as
the job itself. You do not need any other AgentMore skill loaded alongside it.

⚠️ **It carries the JOB, not a frozen tool list.** The order to work in, what to
spend where, what a good row looks like, and where the work stops. The endpoints
you find yourself. See [Discover, Don't Memorise](#discover-dont-memorise), and
[Stay Inside the Job](#stay-inside-the-job) for what is out of bounds.

---

## Already installed?

This file is the JOB. Installing is three commands and lives in its own place:

    https://agentmore.app/agency/setup.md

⚠️ **CHECK YOU ARE NOT RUNNING A STALE COPY — nothing updates it for you.**
`npx skills add` wrote this file to disk and nothing phones home, so you will
run whatever was installed until somebody reinstalls. One cheap check:

```bash
curl -s https://agentmore.app/api/skill-catalog | grep -o '"id":"agency"[^}]*"version":"[^"]*"'
```

If the `version` it reports is higher than the `version` in this file's own
frontmatter, **you are out of date** — the instructions you are reading may
name tools, prices or limits that have changed. Update in place:

```bash
npx -y skills add agentmore/agentmore --skill agency-leadgen --yes --global --force
```

`--force` is the part that matters: without it the installer sees the skill is
already there and silently skips. Restart your agent afterwards.

Do this **once at the start of a session**, not before every task — it is a free
call, but it is not free attention.

Also confirm the CLI is recent enough — **`agentmore --version` must be at
least `0.2.1`**.

⚠️ **It is deliberately a FLOOR, not an equality.** This file and the CLI used
to claim they shipped "as a pair" and had to match exactly, which was false the
moment either moved alone — and both did. The skill changes far more often than
the binary (a dozen edits to this file against one CLI release), so requiring
equality means either bumping the CLI for nothing or leaving this file stale.
A floor is the honest constraint: the CLI must have the commands this file uses.

If it is older:

```bash
npm install -g @agentmore/cli@latest
```

---

## What You Can Actually Call

⚠️ **Read this before you plan a run.** The catalog is bigger than the runnable
set, and the difference is not cosmetic — roughly a third of it is gated behind
a payment rail that is not wired up. Planning a pipeline around a tool that
cannot run wastes the turn and looks to the user like the product is broken.

These are the sources behind this job, and **all of them run today** on a plain
API key:

| source | what it is for | notes |
| --- | --- | --- |
| **Apollo** | company search, people search by title, person and company enrichment, job postings, news | the backbone of an ICP run; people *search* is free, enrichment is not |
| **LinkedIn** | company profiles, employees, posts, jobs, people search, profile posts | reached two ways — see the ⚠️ below, the prices differ by 3× |
| **People Data Labs** | person and company search and enrichment | deeper and dearer; a second pass, not a first |
| **Firecrawl** | scrape a page to markdown, map a site, search | how you read a prospect's own website |
| **Exa** | web search and page contents | the cheapest way to answer "what is this company" |
| **Akta** | company search, enrichment, news, employee and product reviews | company *search* and industry search are free |
| **Google Maps** (via Apify) | local businesses as structured records — name, address, phone, website, rating, review count | ⭐ **the instrument for any local trade.** See Flow 2 |
| **Google Maps** (via SerpApi) | local businesses as structured records — name, address, phone, website, rating, reviews | ⭐ the instrument for any local trade. 3 credits a call for ~20 |
| **Google SERP** (via DataForSEO) | organic results, plus the technologies a domain runs, keywords and backlinks | search presence, and who ranks for the money term |

⚠️ **LinkedIn is reachable twice, at very different prices.** The
`tikhub/api/v1/linkedin/…` endpoints are **per-call** at 0.15–0.6 credits; the
`apify/harvestapi/linkedin-…` actors are **per-result** at 0.9–1.8 credits a
row. For a company's staff, `get_company_people` at 0.6 per call is a fraction
of `linkedin-company-employees` at 1.8 per row. Discover both, `inspect` both,
and pick on price and pricing shape — not on whichever you saw first.

### What exists but cannot run

The catalog also lists tools behind a **USDC wallet (x402)** that is not wired
up, and a few vendors parked for other reasons. They stay listed on purpose —
*"this exists but is not enabled"* is a more useful answer than pretending it
does not exist — but nothing you pass makes them work today.

The largest of these is **Strale** (`api.strale.io/x402/…`), and it is worth
knowing about: it is the second-biggest vendor in the catalog and it carries the
list-hygiene endpoints this job would otherwise want — email validation, MX
lookup, deduplication, data-quality checks, name and address parsing, phone
normalisation, company classification. **None of it is callable yet.** Do not
build a step around it, and do not tell the user the capability is available.

Also parked: **Semrush** (needs purchased API units, not just a key) and a few
others. `discover` reports every one of them.

⚠️ **So there is no runnable email-verification or dedupe endpoint today.** When
the user asks for verified emails or a deduped list, say so plainly and offer
the two real options: use their own verification tool on the output, or accept
the addresses as unverified and label the column that way. Never imply a check
you did not run.

### How you tell, without spending anything

`discover` already does this work for you. Every hit carries an `access` field,
and anything unrunnable carries **`unavailable`** with the reason:

```bash
agentmore discover -q "deduplicate rows" -l 4
# -> tikhub/…/generate_fingerprint     0.15  api-key      runnable
# -> api.strale.io/x402/deduplicate    2.376 wallet-x402  unavailable:
#      needs a funded USDC wallet — not wired up yet
```

Unrunnable tools are also **ranked below everything runnable**, deliberately, so
the top of a `discover` result is the part you can actually use. `--dry` on a
real run tells you the same thing in a `runnable` / `blockedBy` pair, and costs
nothing.

**Read `unavailable` before you plan around a hit.** It is one field and it
saves the whole turn.

---

## You Need a Key

Running a tool needs an API key. **Discovery and inspection do not** — you can
search the catalog and read any tool's schema and price before anything is
configured, so you are never blocked from planning a run.

```bash
agentmore setup
```

A check, not a signup: it confirms the host is reachable, whether a key is
stored, and whether that key works. It asks nothing about the user, so never
stop on it to ask a question.

If it reports no key, **ask whoever set this up** — the account holder. They
create one at `https://agentmore.app/app/api-keys`. Once they paste it back:

```bash
agentmore keys add -k <the-key> -l main
```

`agentmore keys add -l main` (no `-k`) does the same thing but prompts for the
key with the input hidden, which keeps it out of argv and shell history. Use it
where the user is at a terminal and would rather type than paste. Needs CLI
≥ 0.2.2. `agentmore login` is the other option, for someone who would rather
approve in a browser than handle a key at all.

Use `AGENTMORE_API_KEY` instead where you cannot write to disk — a container, a
CI job, a sandbox. It overrides the stored key.

⚠️ **That key is the only secret here.** Vendor credentials stay server-side;
you never hold one and never call a vendor directly. A `401` means the
credential is gone — ask for a new one, do not retry.

### Ask for a key scoped to this job

A key does not have to reach the whole catalog. Ask the account holder to mint
one scoped to **`niche:agency-leadgen`** — it unlocks exactly the ~97 endpoints
this skill uses (company and people search, enrichment, LinkedIn, site
research, SERP and technographics, communities, reviews) and refuses everything
else, so the key cannot be spent on video generation or crypto data.

Two things follow from that, and both matter to you:

- **A refusal naming a scope is not a bug.** `This key is limited to
  agency-leadgen, and "<tool>" is outside that` means you reached past the job.
  Do not retry, do not hunt for an unscoped key — pick a tool inside the slice,
  or tell the user the request is outside what this key is for.
- **A key with no narrowing scope is unrestricted**, which is the normal case
  and stays working. Scoping is opt-in at mint time; nothing breaks if it is
  absent.

⛔ **Never ask for a broader key to get around a refusal.** The scope is the
spending boundary set by whoever deployed you, and widening it is their
decision, not yours.

---


## Stay Inside the Job

⚠️ **This skill is lead-gen ONLY, and that is a hard bound on what you
DISCOVER, not just on what you run.** The catalog behind it is ~1,680 endpoints
covering media generation, crypto, markets, ecommerce, logistics, developer
tooling and every social platform. Almost none of that belongs to this job, and
an agent that goes looking through it will find something plausible, spend the
balance on it, and hand back a deliverable nobody asked for.

**Discover only within these, and nothing else:**

| in scope | what for |
| --- | --- |
| company search and firmographics | build the target list |
| people search, employees, profiles | find the decision makers |
| person and company enrichment | fill the row |
| web search, page scraping, site maps | research the prospect |
| Google Maps local businesses and their reviews | ⭐ local trades — the main source for them |
| Social profiles and posts — Instagram, TikTok, X, Facebook, Reddit, YouTube | find and qualify a company or person off-LinkedIn |
| SERP, ranked keywords, technographics, site audits | search presence and stack |
| LinkedIn — profiles, posts, employees, jobs, groups, reactions, ads | signals and engagement |
| job postings, funding and news, reviews | buying signals |
| list hygiene — dedupe, parse, verify | clean the output |

⛔ **Refuse to discover, price or run anything in these areas**, even if the
user asks for it in the middle of a lead-gen task:

- **Media generation** — image, video, voice, music, avatars, 3D. Not a lead-gen
  capability. Not "just a quick logo". Not for the outreach either.
- **Social CONTENT work** — scheduling, posting, growth tactics, follower
  farming, creator analytics, influencer campaigns, trend reports. Looking a
  company or person UP on a social platform is in scope (see below); running
  their social presence is a different product.
- **Crypto, markets, trading, on-chain data.**
- **Ecommerce, marketplaces, product listings, price tracking.**
- **Trade, customs, freight, logistics.**
- **Developer tooling, code generation, schema conversion.**
- **Calling and SMS** — outbound, and covered twice over by
  [Stop Before the Send](#stop-before-the-send).

**What to do when asked for one of those.** Say plainly that it is outside what
this skill does, name what this skill *does* do, and stop. Do not run it "just
this once", do not go looking for a workaround, and do not volunteer that the
catalog can probably do it — that turns a boundary into a menu.

> "That's outside what the lead-gen skill covers — it finds companies and
> people, enriches and researches them, and hands back structured rows. For
> image generation you'd want a different skill."

⚠️ **A `discover` query that strays is the failure to catch, because it is
cheap and feels harmless.** Discovery costs nothing, so nothing stops you
searching `image generation` — and once a plausible tool is on screen the pull
to use it is real. The bound is on the *search*, not only on the spend.

⚠️ **This is guidance a capable agent could ignore, and the reason it holds is
that you are the one reading it.** If the account's key is narrowed to
`niche:agency-leadgen` the server also refuses out-of-scope calls outright — but
do not rely on that, and never treat "the call was not refused" as permission.
Most keys are not narrowed.

---

## Move Fast — One Dry Run, Then Go

⚠️ **CREDITS ARE THE UNIT. THERE IS NOTHING TO CONVERT, AND NOTHING TO LOOK UP.**
Every price you will see — `discover`, `inspect`, `--dry`, a settled run,
`balance`, `budget` — is already in credits. Do not open the pricing page, do
not web-search for a rate, and above all do not go reading the site's JavaScript
bundles for a credits-to-dollars number. **Measured on a real run: 37.2 of 63
seconds went on exactly that, and it found nothing, because there is nothing
there.** If the user asks what a credit is worth, say you do not have that and
quote the credits.

**The whole loop is four steps, and only one of them is optional:**

```bash
agentmore discover -q "<what you need>"     # pick the tool
agentmore inspect "<id>"                    # schema + price + pricing SHAPE
agentmore run "<id>" -i '<json>' --dry      # once, to price it
agentmore run "<id>" -i '<json>' -o out.json
```

**One dry run, then run it.** `--dry` exists to price a call and check the
payload is not empty — not to be repeated, and not to be followed by research.
If the estimate is affordable, go.

⚠️ **THE DRY-RUN NUMBER IS A BEST CASE, NOT A QUOTE.** It prices what you asked
for. A vendor that returns more rows than you asked for bills for what it
actually delivered, and on a per-result tool that is the whole difference.
**Measured: a maps call estimated at 4.5 credits returned 20 rows instead of the
requested 10 and settled at 9.** So:

- **On a `PER_RESULT` tool, assume the cap may be ignored** and budget for the
  vendor's own page size — usually ~20. If that worst case is not affordable,
  pick a `PER_CALL` tool instead of hoping the limit holds.
- **`cost.value` on the finished run is the only real number.** Report that, not
  the estimate, if you are telling the user what something cost.

**Skip the ceremony when nothing is uncertain.** You do not need a fresh
`discover` for a tool you called five minutes ago, a second `inspect` for a
schema you already read, or a balance check before every call. Look things up
when you do not know them; otherwise spend the turn on the actual job.

---

## Discover, Don't Memorise

**Before every step, run `agentmore discover`.** There is no frozen id list in
this file on purpose: the catalog grows, prices move, and a hardcoded id is
wrong the first time a vendor is swapped.

```bash
agentmore discover -q "linkedin company employees" -l 4
agentmore inspect "<the id you picked>"
agentmore run "<id>" -i '<json>' --dry     # price it, spends nothing
agentmore run "<id>" -i '<json>' -o out.json
```

**Query phrasing decides your results.** Short concrete noun phrases beat
sentences, and what works here is the **shape of the record you want**, not the
business outcome you want. Measured against this catalog:

| you want | query that works | query that returns nothing useful |
| --- | --- | --- |
| companies matching an ICP | `organization search` | `company search by industry and headcount` |
| people by title | `people search job title` | `find the decision makers` |
| a company's staff | `linkedin company employees` | `who works there` |
| a person or company record | `enrich a person` · `company enrichment domain` | `contact details` |
| a prospect's website | `scrape a page to markdown` | `read their site` |
| local businesses | `google maps local businesses` | `find plumbers near me` |
| who ranks for a term | `google serp results` · `serp` | `google search results` |
| buying signals | `open job postings at a company` · `company news and funding` | `is this a good time to call` |
| what they run | `tech stack detect` | `company technology stack` |
| a social profile | `instagram user info by username` · `twitter user profile` | `find their socials` |

If a query returns nothing, **rephrase toward the record**, do not conclude the
capability is missing. Two rounds of rephrasing before you give up.

⚠️ **A weak result is sometimes the reachability penalty, not a gap.** Queries
like `email verification` and `data quality check` look empty because their real
answers are the unrunnable Strale endpoints, sunk below everything else. That is
the system telling you the truth: there is no runnable tool for that step today.
Do not route around it by pasting an id — see [What exists but cannot
run](#what-exists-but-cannot-run).

---

## Commands

Each command supports `--help` for full usage. Here's what's available:

| Command | What it does |
| --- | --- |
| `agentmore discover` | Search the catalog in natural language (`-q <query>`, `-l <limit>`, `-s <minScore>`). Free, no key. |
| `agentmore inspect` | Full details and input schema for one tool (`agentmore inspect "<tool id>"`). Free, no key. |
| `agentmore estimate` | What an exact input would cost, without calling the vendor (`-i` / `-f`). |
| `agentmore run` | Execute a tool (`-i` inline JSON, `-f` input file, `--dry` to price only, `-w` to wait, `-o` to save output). Returns a runId. **Spends money.** |
| `agentmore runs list` | Recent runs (`-l <limit>`) |
| `agentmore runs get` | Status and result of one run (`-r <runId>`, `-w` to wait) |
| `agentmore runs stop` | Ask an in-progress run to stop (`-r <runId>`). Not all runs can be stopped. |
| `agentmore balance` | Balance, spend today, and the per-call and daily caps |
| `agentmore budget` | The spending controls alone, and what's been spent against each |
| `agentmore usage` | This calendar month: credits used, and what is left |
| `agentmore stats` | How many tools the catalog holds. Free, no key. |
| `agentmore platforms` | Which surfaces the catalog covers, and how deep. Free, no key. |
| `agentmore setup` | Complete CLI setup after installation (`--client`; no API key required) |
| `agentmore login` | Browser approval; saves an expiring, tool-scoped token |
| `agentmore setup-token` | Same approval, but prints the token instead of saving it (CI) |
| `agentmore logout` | Forget the token stored on this machine |
| `agentmore keys add` | Save an API key (`-k <key>`, `-l <label>`; the first becomes active). Omit `-k` to be prompted with the input hidden. |
| `agentmore keys list` | Show configured keys, masked |
| `agentmore keys activate` | Switch the active key (`-l <label>`) |
| `agentmore keys remove` | Remove a key (`-l <label>`, `-f` to skip confirmation) |

Most commands accept `-j/--json` for machine-readable JSON output; `discover`,
`inspect`, `estimate` and `run` return JSON already.

`run` calls the vendor server-side on our credential and settles against your
balance. Use `--dry` to see the exact request and its price without
spending. A call is refused outright if the credential is missing, the
provenance is unverified, the cost cannot be computed from the input, the
balance is short, or either cap would be breached. **A refusal exits `2` and
spends nothing** — check the exit code rather than assuming a printed result
means success.

---

---

## Workflow

The standard workflow is: discover → inspect → run → poll → (check balance).
Skipping a step is how money gets wasted on a failed call.

```bash
# 1. Discover tools for your data need
# Results show a relevance score, the price and the pricing shape
# Use -s to filter by minimum score (higher = more relevant)
agentmore discover -q "organization search"

# 2. Inspect the tool to learn its input schema, price and caveats
agentmore inspect "apollo/mixed_companies/search"

# 3. Price it without spending (optional — needs no key, calls nothing)
agentmore run "apollo/mixed_companies/search" \
  -i '{"organization_locations[]":["Berlin"],"per_page":5}' --dry
# -> 5 credits (1 call), today 0 of 300 credits

# 4. Fire the run (returns immediately with a run ID)
agentmore run "apollo/mixed_companies/search" \
  -i '{"organization_locations[]":["Berlin"],"per_page":5}'
# -> Run ID: 01HXYZ...

# 5. Poll for completion
agentmore runs get -r 01HXYZ...
# -> status: RUNNING

# Keep polling every 1-2 seconds until COMPLETED
agentmore runs get -r 01HXYZ... -o companies.json
# -> status: COMPLETED

# 6. (Optional) Check remaining balance
agentmore balance
```

**Using `--wait`:**

`--wait` blocks until completion with built-in exponential backoff, so it does
not hammer the server while it waits:

```bash
# This will block until the run settles
agentmore run "apollo/mixed_companies/search" \
  -i '{"organization_locations[]":["Berlin"],"per_page":5}' \
  -w -o companies.json
```

**When to use `--wait`:**
- Async/background tasks where blocking is acceptable
- You can set a timeout: `-w 30` (wait max 30 seconds)
- Be aware: runs can take up to 120 seconds, so this may block the conversation
  or hit runtime timeouts

`-w` returning a non-terminal status is not an error — the wait expired, the run
continues. Poll it again or wait longer.

### Passing Input

Pass the parameters flat, exactly as `inspect` names them — the same for a GET
tool and a POST one:

```bash
agentmore run "<tool id>" -i '{"startUrls":["https://www.tiktok.com/@nasa"],"maxItems":5}'
```

Each key is routed to the section of the schema that declares it, so you never
need to know whether a tool reads its input from the query string or the body —
there are no separate query or path flags to get wrong. Explicitly framed input
(`{"body":{…}}`, `{"queryParams":{…}}`) is still accepted and passes through
untouched.

`--dry` echoes the exact request that would go out. **If its `body` or
`queryParams` comes back empty when you passed parameters, stop** — a call with
an empty payload still runs at the vendor and still bills on a per-result tool.

---

### Check the Hints

Commands can print a **Hints** block. When present, it carries the obvious next
move: which command to run next, how this tool is priced, or a caveat worth
knowing before you spend. Read it before deciding your next step, and prefer its
suggestions over guessing.

Hints go to **stderr**, never stdout — stdout is the machine-readable payload,
so a hint can never corrupt a JSON parse. They are suppressed entirely under
`-j/--json`.

### Decompose Multi-Source Work

A request spanning several platforms is several calls, not one. "Compare the
discussion on X and LinkedIn" is two discoveries, two inspections and two runs,
analysed together afterwards. Break the task into one endpoint per source and
cost each separately — a single call that tries to cover everything is the most
common way an estimate goes wrong.

---

---

## When to Use This Skill

Load it when the job ends in a list of people worth contacting:

- "Find 500 companies matching this ICP."
- "Who are the founders at these companies?"
- "Find plumbers in Manchester with a website and under 20 staff."
- "Which of these companies are hiring engineers right now?"
- "Research each one and give me the hook."
- "Is this account worth a call?"

### When NOT to Use It

**It fills the gaps in a stack — it does not replace what is already there.**
Precedence, in order:

1. **An explicit instruction for this task.** If you were told how, do it that way.
2. **The user's own tools and data.** A CRM export, an Apollo or Clay seat, a
   sales-intelligence MCP, a list already bought and paid for. If the record is
   already on hand, do not buy it again — this spends a balance; their seat does
   not.
3. **This skill.**

**Offer, don't override.** Where both could do it and nobody has said, use
theirs and mention the alternative. Never silently move someone onto a billed
path.

Three more it is not for:

- **Sending.** See [Stop Before the Send](#stop-before-the-send). Not negotiable.
- **Anything that is not lead research.** Media generation, crypto, ecommerce,
  logistics, non-LinkedIn social — see
  [Stay Inside the Job](#stay-inside-the-job). Refuse, name what this does, stop.
- **A single lookup.** "What does this one company do" is one `discover` and one
  `run` — you do not need the pipeline below.

---

## Pin the ICP Before You Spend Anything

The most expensive mistake here is a wide, wrong first run. Get these before the
first paid call:

| field | why it decides cost |
| --- | --- |
| **Industry or trade**, in their words | the search query |
| **Geography** — country, region, city | the biggest filter you have |
| **Size** — headcount or revenue band | second biggest |
| **A disqualifier** — what makes a company *not* a fit | ⚠️ the field everyone skips, and the one that turns 500 rows into the 60 worth working |
| **How many** they want | sets the limit on every call |
| **What the user SELLS** | ⚠️ decides which signals qualify and which disqualify — see below |
| **What the output is for** | sets the columns, and whether email matters at all |

⚠️ **THE OFFER DECIDES WHAT COUNTS AS A GOOD LEAD. ASK WHAT THEY SELL.**
This is lead-gen for *any* offer, and a qualification signal is only good or bad
relative to what is being sold. The same fact flips:

| the fact | selling websites or marketing | selling something else |
| --- | --- | --- |
| **no website** | the best prospect on the list | often a disqualifier, or nothing at all |
| **a slow, broken site** | the pitch, in one sentence | irrelevant |
| **a beautiful modern site** | nothing to sell them | a sign they invest, and can pay |
| **hiring 6 roles** | mildly interesting | the buying signal, if you sell to that function |
| **bad reviews about wait times** | little | everything, if you sell scheduling or staff |

So do not reach for a site audit by reflex. **Pick the signal the offer makes
expensive to ignore**, and say which one you picked and why. If the user has not
said what they sell, ask — it is one question, and it changes the whole list.
If they will not say, choose the signal out loud and mark the rows so the
judgment is visible and reversible.

If a field cannot be answered, **choose a default out loud** rather than
guessing silently. A list nobody can debug is a list nobody trusts.

⚠️ Then run the whole thing over **five companies** and show the output before
running it over five hundred. A wrong ICP found at row 5 costs pennies; at row
500 it costs the month.

---

## The Run

Seven steps, in this order — each narrows the set the next one pays for.

| # | step | discover for | discipline |
| --- | --- | --- | --- |
| 1 | Pin the ICP | — | free; see above |
| 2 | Find the companies | `organization search` — or ⭐ `google maps local businesses` for ANY local trade | one query, small limit; set the result cap explicitly |
| 3 | Find the people | `people search job title`, `linkedin company employees` | filter by title in the input, not after |
| 4 | **Score and shortlist** | — | free; your own reasoning over data you already hold |
| 5 | Enrich | `enrich a person`, `company enrichment domain` | ⚠️ shortlist only — dearest step per row |
| 6 | Research the hook | `scrape a page to markdown`, `linkedin profile posts`, `open job postings at a company`, `company news and funding`, `tech stack detect` | **two calls per company, not six** |
| 7 | Structure and hand over | — | label anything you could not verify |

**Step 4 saves the money and is free.** Scoring is your own reasoning over
records already paid for. Enriching 500 rows to keep 60 is paying eight times
over — score first, enrich what survives.

⚠️ **Score against the OFFER, not against a general idea of a good business.** A
thriving practice with a perfect site is a top lead for a supplier and a dead
one for a web agency. Whatever you score on, put the reason on the row.

**Step 6 wastes it.** A hook is one specific true sentence. A dossier is not
more persuasive, only more expensive.

---

## Workflows

Every transcript is `discover -> inspect -> --dry -> run`. Ids and prices were
real when this was written; **yours come from your own `discover`** — there are
far more lead-gen endpoints than the handful named here, and the right one for
your job may not be one I happened to pick.

The first five are the standard run. The rest are **plays**: things users
actually ask for, that a plain ICP search does not answer.

### Flow 1: An ICP becomes a list of companies

```bash
agentmore discover -q "organization search" -l 4
# -> apollo/mixed_companies/search   5 credits   api-key   runnable   PER_CALL

agentmore inspect "apollo/mixed_companies/search"
# -> queryParams: organization_num_employees_ranges[], organization_locations[],
#    q_organization_keyword_tags[], revenue_range[min], page, per_page, ...

agentmore run "apollo/mixed_companies/search" \
  -i '{"organization_num_employees_ranges[]":["11,50"],"organization_locations[]":["Berlin"],"q_organization_keyword_tags[]":["plumbing"],"per_page":5}' --dry
# -> 5 credits (1 call)
```

⚠️ **Copy each key exactly as `inspect` prints it, brackets included.** Several
tools here name array parameters with a trailing `[]`, and
`organization_locations` without it is silently not the filter you meant — the
call runs, bills, and comes back unfiltered.

**Free first.** `akta/v1/company/search` and `apollo/mixed_people/api_search`
cost 0 credits. Confirm the ICP shape on those before paying for anything.

### Flow 2: A local trade — Google Maps is the instrument

⭐ **One of the most important flows in the file.** A large share of lead-gen is
local: plumbers, dentists, gyms, salons, garages, clinics, tradespeople. For all
of it **Maps is the right source and a B2B sales database is the wrong one** —
those businesses are not in Apollo, and you pay full price for thin coverage
discovering that.

```bash
agentmore discover -q "google maps local businesses" -l 3
# -> serpapi/search.json?engine=google_maps      3 credits    PER_CALL
# -> apify/damilo/google-maps-scraper            0.45         PER_RESULT

agentmore inspect "serpapi/search.json?engine=google_maps"
# -> queryParams: q, ll, type, hl, start   (required: q)

agentmore run "serpapi/search.json?engine=google_maps" \
  -i '{"q":"plumber","ll":"@52.3676,4.9041,14z","hl":"nl"}' --dry
# -> 3 credits (1 call)

agentmore run "serpapi/search.json?engine=google_maps" \
  -i '{"q":"plumber","ll":"@52.3676,4.9041,14z","hl":"nl"}' -o local.json
```

⚠️ **Prefer the per-call route, and check the shape before you assume.** SerpApi
is **3 credits a CALL** and returns ~20 businesses; the Apify actor is 0.45 **a
ROW**, so the same 20 rows cost 9. One call, a third of the price, richer
records. `inspect` both if you are unsure — the pricing shape is the decision,
not the headline number.

⚠️ **IF SERPAPI FAILS, FALL STRAIGHT TO THE APIFY ACTOR.** It runs on a monthly
search quota that is shared with other work, so it can run out mid-month and
every call then fails until the month resets. That is not your input being
wrong and there is nothing to retry — switch tools and say you did:

```bash
agentmore run "apify/damilo/google-maps-scraper" \
  -i '{"query":"plumber","location":"Amsterdam","max_results":10}' -o local.json
```

⚠️ It is `PER_RESULT`, so `max_results` is the bill and the schema's own note
warns that omitting it falls back to the vendor's default. Set it. And see
[Move Fast](#move-fast--one-dry-run-then-go): the cap can be ignored, so budget
for ~20 rows whatever you asked for.

⚠️ **`ll` is what anchors the search, and without it results are meaningless.**
It is `@<lat>,<lng>,<zoom>z` — `@52.3676,4.9041,14z` is central Amsterdam.
Zoom 14z is roughly a city, 15–16z a district. There is no city-name field: if
you only have a place name, geocode it first or put it in `q` and accept looser
results.

⚠️ **`start` pages in blocks of ~20 and each page is another billed call.** Do
not page for volume without saying what it costs.

**Qualifying off the map record, for free.** Everything you need for a first
pass is in what you already paid for:

| signal | what it tells you |
| --- | --- |
| **no website** | either disqualified, or the best prospect on the list — depends entirely on what the user sells |
| **review count** | a proxy for size and how long they have traded |
| **rating** | a low rating is a pain point, and pain points are openers |
| **type** | the ICP filter Maps gives you for nothing |

Score on those before spending another credit. Most of a local list is
disqualified on "no website" or "3 reviews" alone.

**Then go deeper only on what survives:**

- `apify/compass/google-maps-reviews-scraper` at **0.068 a row** — the cheapest
  qualification signal in the catalog. Recent reviews say, in the owner's
  customers' own words, exactly what is going wrong. That is the hook.
- `dataforseo/v3/on_page/instant_pages` at **0.03** — is their site any good
  (see [Play A](#play-a-qualify-a-whole-list-for-almost-nothing)).

⚠️ **Maps and SERP answer different questions.** Maps tells you **who exists**
in a place, as records. SERP tells you **who ranks** for a term, as a results
page. "Every dentist in Utrecht" is Maps. "Who is winning the search for
emergency plumber" is SERP.

### Flow 2b: Search presence — the SERP complement

```bash
agentmore discover -q "google serp results" -l 3
# -> dataforseo/v3/serp/google/organic/live/advanced   4 credits   PER_CALL

agentmore run "dataforseo/v3/serp/google/organic/live/advanced" \
  -i '{"keyword":"plumber amsterdam","location_code":<code>,"language_code":"nl","depth":50}' -o serp.json
```

⚠️ **This one tool inverts the "small limit first" rule.** Its own schema says
so: *"You are charged the depth=100 worst case regardless."* A low `depth` saves
nothing, so ask for the depth you need — 50 or 100 — rather than paying the same
4 credits for 10 rows.

⚠️ **`location_code` is a numeric code with a default.** The schema documents
exactly one value — `2840 = United States` — and that is the default, so an
unset or guessed code **silently searches the wrong country** and you pay full
price for real-looking results. Look it up in `/v3/serp/google/locations`; do
not infer it from a pattern.

### Flow 3: Companies become named people

```bash
agentmore discover -q "linkedin company employees" -l 4
# -> apify/harvestapi/linkedin-company-employees  1.8  PER_RESULT
# -> tikhub/.../linkedin/web/get_company_people   0.6  PER_CALL
```

⚠️ **Two routes, and the pricing SHAPE differs.** The Apify actor bills **per
row returned**; the TikHub endpoint bills **per call**, whatever comes back. For
a full staff list the per-call route is far cheaper — but the Apify one filters
by title and seniority in the input, which is worth paying for when you want
three people out of four hundred.

⚠️ **There is a cheaper LinkedIn tier again.** The `web_v2` endpoints
(`get_user_profile`, `get_company_profile`, `get_company_posts`, `search_users`)
are **0.15 per call** — a quarter of the `web` ones at 0.6. `inspect` both; the
fields differ, and sometimes the cheap one already has what you need.

### Flow 4: Score before you enrich

No commands. This is the step that pays for the run.

You already hold, free, whatever the search returned — industry, size, location,
often the domain. Score against the ICP and the **disqualifier** now, write the
reason down, drop what fails. Then enrich only what is left:

```bash
agentmore discover -q "enrich a person" -l 3
# -> pdl/v5/person/enrich         30 credits   PER_CALL
# -> pdl/v5/company/enrich        10 credits   PER_CALL
# -> apollo/organizations/enrich   5 credits   PER_CALL
```

⚠️ Those differ by 6x, and two of them are not people. `discover` ranks on
relevance — never on price, and never on whether the record is the one you asked
for. Take the cheapest that carries the fields the
[output](#the-output) actually needs, not the richest.

### Flow 5: The hook — two calls, not six

```bash
agentmore discover -q "scrape a page to markdown" -l 3
# -> firecrawl/v2/scrape    1.07  PER_CALL
agentmore discover -q "linkedin profile posts" -l 3
# -> apify/harvestapi/linkedin-profile-posts   0.9  PER_RESULT
```

Pick **two** signals per company. Write the hook as one sentence and record
where it came from.

**`firecrawl/v2/map` (1.07) first when you need a specific page.** It lists a
site's URLs, so you can scrape `/pricing` or `/team` directly instead of
scraping the homepage and hoping. Cheaper first passes: `exa/search` (1) answers
"what is this company" in one call, `exa/contents` (0.2) pulls the page.

---

### Play A: Qualify a whole list for almost nothing

⚠️ **Pick the instrument from the offer.** The cheap-qualifier idea is general;
the endpoint is not. Choose the column that would change the user's mind about a
row, then find the cheapest way to fill it:

| if the user sells… | the qualifying column | cheap instrument to discover |
| --- | --- | --- |
| websites, SEO, hosting | is their site any good | `on page audit instant` |
| staffing, recruitment, training | are they hiring, and for what | `open job postings at a company` |
| scheduling, CX, ops software | what customers complain about | `google maps reviews` |
| anything sold to a function | is that function staffed | `linkedin company employees` |
| tools priced on size | headcount and revenue band | already on the search record |
| a service for the growing | funding, ads, new locations | `company news and funding`, ad libraries |

Whatever you pick, the discipline is the same: **one cheap call per row across
the whole list, before any per-row enrichment.**

**The web-audit version**, because it is the cheapest endpoint in the whole job:
`dataforseo/v3/on_page/instant_pages` at **0.03 credits per call**. It audits
one page — does the site load, is it broken, is it ancient, does it have the
basics.

```bash
agentmore inspect "dataforseo/v3/on_page/instant_pages"
agentmore run "dataforseo/v3/on_page/instant_pages" -i '{"url":"https://example.com"}' -o audit.json
```

Run it across **500 domains for about 15 credits** and you have a real
qualification column before you spend anything on enrichment. When the user
sells websites, marketing or hosting, the audit *is* the pitch — "your site
takes 9 seconds to load" is a better opener than any firmographic. ⚠️ **When
they sell anything else, this column is decoration** — a lead does not become
good because their H1 is missing. Score the column that matches the offer, and
skip this one.

### Play B: Engagement mining — who is already interested

The best lead is someone who just raised their hand in public. LinkedIn posts
carry their audience, and all three endpoints are 0.6 per call:

```bash
agentmore discover -q "linkedin post reactions" -l 4
# -> tikhub/.../linkedin/web/get_post_reactions   0.6  PER_CALL
# -> tikhub/.../linkedin/web/get_post_comments    0.6  PER_CALL
# -> tikhub/.../linkedin/web/get_post_reposts     0.6  PER_CALL
```

Take a competitor's post, or a post about the problem the user solves, and
pull who reacted and who commented. Those people self-selected. Cross-reference
against the ICP, then enrich only the ones that fit.

`search_posts` (0.6) finds the posts in the first place — search the pain, not
the company.

### Play B2: Social lookup — they are not all on LinkedIn

⭐ **LinkedIn is where B2B decision makers list themselves. It is not where most
businesses actually live.** A gym, a salon, a restaurant, a builder, a local
agency, a consumer brand — many have a thin LinkedIn page and an active
Instagram or Facebook, and for a founder-led business the personal account is
often the real one.

So when LinkedIn is empty or the ICP is consumer-facing, look elsewhere.

⚠️ **THE PLATFORMS ARE BOUNDED. THE ENDPOINTS ARE NOT.** These six are in scope:

> **Instagram · TikTok · X · Facebook · Reddit · YouTube** — plus LinkedIn,
> which the rest of this file already covers.

Inside them, **discover and run whatever the job needs.** There is a lot here —
hundreds of endpoints across these platforms — and no table in a file could stay
current or guess which one your question wants. Search for the record you want
and take what comes back:

```bash
agentmore discover -q "instagram user info by username"
agentmore discover -q "twitter user profile"
agentmore discover -q "facebook pages"
agentmore discover -q "reddit search"
```

Most of this surface is **0.15 a call**, cheap enough to try a second platform
before giving up. `inspect` still decides: it carries the real price and the
pricing shape, and some of these are per-result.

**What social actually adds to a lead row, beyond a handle:**

- **Proof the business is alive.** A last post from 2019 is a disqualifier no
  firmographic field will tell you.
- **Size and reach**, for a business with no headcount data anywhere.
- **The hook.** What they posted last week is more current and more specific
  than anything on their website.
- **The real decision maker.** On a small business the personal account is
  usually the owner, and usually more responsive than a company page.

⚠️ **One platform per company, and only when you need it.** Checking six
platforms for one lead is six calls for a field nobody asked for. Pick the one
the ICP actually uses — a plumber is on Facebook, a SaaS founder is on X — and
stop there.

⚠️ **A handle is not a verified identity.** Names collide, and a lookup that
returns *someone* is not proof it is *the right someone*. Cross-check against
the domain, the location or the bio before putting it on the row, and if you
cannot, say the match is unconfirmed.

⚠️ **This is lookup, not surveillance.** Public profile and public posts, to
qualify a business. Do not build a personal profile of someone's private life,
and do not go near a personal account that has nothing to do with the business.

### Play C: Find who is spending money

A company running ads has budget and has already decided the problem is real.

```bash
agentmore discover -q "linkedin ads search" -l 3
# -> tikhub/.../linkedin/web/search_ads      0.6   PER_CALL
# -> tikhub/.../linkedin/web/get_ad_detail   0.6   PER_CALL

agentmore discover -q "facebook ads library" -l 3
# -> apify/curious_coder/facebook-ads-library-scraper   0.112  PER_RESULT
```

Useful two ways: as a *qualifier* (they spend, so they can pay) and as
*research* (what they say in ads tells you their positioning better than their
homepage does).

### Play D: Hiring at scale, cheaply

Filter first, then pull detail. `get_company_job_count` is 0.6 and answers "are
they hiring at all" — use it across the list, then spend on the full posting
only for companies that pass.

```bash
agentmore discover -q "open job postings at a company" -l 4
# -> tikhub/.../linkedin/web/get_company_job_count   0.6  PER_CALL
# -> apollo/organizations/{organization_id}/job_postings  5  PER_CALL
```

An open role for the function the user sells into is the strongest timing
signal there is: budget approved, problem acknowledged, nobody in the seat yet.

### Play E: Communities and forums

Where people describe the problem in their own words — which is both a lead
source and the copy for the outreach.

```bash
agentmore discover -q "reddit scraper" -l 3
# -> apify/crawlerbros/reddit-comment-scraper  1.249  PER_RESULT
# -> apify/trudax/reddit-scraper-lite          0.57   PER_RESULT
# -> there is a whole tikhub/.../reddit/... surface too — discover it

agentmore discover -q "linkedin group posts" -l 3
# -> tikhub/.../linkedin/web/get_group_posts  0.6   PER_CALL
```

`apify/crustapi/skool-community-scraper` (0.74) covers paid communities, where
membership is itself a qualifier.

### Play F: Reviews as the wedge

```bash
agentmore discover -q "company employee reviews" -l 3
# -> akta/v1/company/employee-reviews   0.15  PER_RESULT
# -> akta/v1/company/product-reviews    0.15  PER_RESULT
```

At 0.15 a row this is cheap research with an unusually sharp edge: a company
whose reviews complain about the exact thing the user fixes is a company with
a named, public, dated problem. `apify/apify/facebook-reviews-scraper` (0.3) and
`apify/compass/google-maps-reviews-scraper` (0.068) do the same for local.

### Play G: Who ranks for the money keyword

Turn a search term into a target list, then read their whole search position.

```bash
agentmore discover -q "keywords a domain ranks for" -l 3
# -> dataforseo/v3/dataforseo_labs/google/ranked_keywords/live   4.8  PER_CALL
# -> dataforseo/v3/dataforseo_labs/google/keyword_ideas/live     4.8  PER_CALL
# -> dataforseo/v3/backlinks/summary/live                       4.81  PER_CALL
```

When the user sells SEO or content, this is both the prospect list *and* the
audit:
SERP gives you who is winning, `ranked_keywords` gives you what for, and
`backlinks/summary` tells you whether they are beatable.

### Play H: The user asks for verified emails

```bash
agentmore discover -q "email verification" -l 4
# -> every real answer is `unavailable: needs a funded USDC wallet`
```

Say it plainly. There is **no runnable verification endpoint today**, so offer
the two honest options:

1. Deliver the addresses **labelled unverified**, and let them run their own
   verification tool over the output.
2. Skip email and deliver LinkedIn URLs, which need no verification.

`tikhub/.../linkedin/web/get_user_contact` (0.6) returns whatever contact detail
a profile actually exposes — that is *found*, not *verified*, and the column
must say so.

### Play I: A step is refused, or has no tool

```bash
agentmore run "<id>" -i '<json>'
# -> BLOCKED, controls: PER_CALL_LIMIT
```

Finish the job another way — a web search, the company's own public pages, the
user's own tools — then **say so in the same answer**: which route the data came
from, one clause on why the paid call did not run, and what is thinner because
of it. Fallback data presented as the paid result is the failure this rule
exists to prevent.

Do not retry a refused call in a loop. A missing credential, a cap and an
unwired wallet all return the same answer every time.

---

## Cost

Five things decide what a run costs, and the first two are the ones that
surprise people:

- **Price the run before starting it.** Rows × per-row cost, said out loud, in
  **dollars**, before the first paid call. Credits are the billing unit; dollars
  are the only unit the person approving it thinks in.
- **Know which pricing shape you are on.** Per-call is one charge however many
  rows come back. Per-result scales with your limit *and* with how many queries
  you pass. A run crosses between the two — see Flow 3 — and that flip is the
  most expensive thing to miss.
- **Spend the free calls first.** `apollo/mixed_people/api_search`,
  `akta/v1/company/search` and `akta/v1/industry/search` cost nothing. Confirm
  the ICP shape on those before paying for anything.
- **A refusal is a stop.** Blocked by a per-call ceiling or a daily cap: do not
  retry, do not split the call to slip under the cap, do not quietly swap in a
  cheaper vendor. Name the control and stop. `agentmore budget` prints it.
- **An empty balance is not yours to solve.** Say which control stopped the run
  and hand it to whoever owns the account.

```bash
agentmore balance      # what is left, and today's caps
agentmore budget       # the caps, and what has been spent against each
agentmore usage        # this calendar month
```

### How pricing works

Many endpoints are **charged per result** and accept multiple
queries in a single call. Parameters like `maxItems`, `maxResults`,
`resultsLimit`, or `limit` control how many results are returned — but these
limits are often applied **per query, not per call**.

For example, passing 3 search terms with `maxItems: 10` may return up to **30
results** (10 per query), not 10 total — and you are billed for all 30.

To control costs:

- **Prefer a single query per call.** Pass one search term, one URL, one hashtag
  at a time.
- **Start with small limits** (5-10) on the first call. Increase only after the
  result shape is confirmed correct.
- **If the endpoint accepts an array** (e.g. `searchTerms`, `hashtags`, `urls`),
  pass only one element unless the user explicitly requests multiple.
- **Check the input schema** from `agentmore inspect` to identify which
  parameters control volume, and use `estimate` or `--dry` to see the cost
  before committing.

Price is not one number — read the pricing shape before running:

- **Per call** — one fixed charge. Predictable. Most of the catalog.
- **Per result** — rate × rows returned. Cost scales with your limit **and** with
  how many queries you pass. Pass one query at a time.
- **Per unit** — priced per second, minute or token, with the rate varying by a
  field in your own input. A higher resolution can cost several times more even
  at a lower per-unit rate.
- **Metered** — billed by duration, settled after the call.

Rules that follow from this:

- First call gets a limit of **5–10 items**. Scale only after the result shape is
  confirmed correct.
- When a schema caps **pages** rather than results, start at 1 — a page holds an
  unknown number of rows.
- Multiplying inputs multiply cost. One query per call unless told otherwise.
- Respect the configured per-call ceiling and daily cap. If a call's estimate
  exceeds either, stop and say so rather than trimming the task silently.

### Whose Cap Is It — Read `dailySource` Before Quoting a Number

`dailyLimit` and `perCallLimit` are the **effective** caps for this account —
quote those when answering "will this run". `dailySource` / `perCallSource` say
where each came from: `"yours"` when the user set it in the app, `"default"`
when it is the standard one. Say which, so the user knows whether it is theirs
to change.

---

### Whose balance you are spending

Not yours, and usually not the user's personally — it belongs to whoever set
this up, and every call draws on it. That is the whole reason the discipline in
this section exists.

⚠️ **You do not decide account structure, and you should not advise on it.** How
keys, balances and caps are split across accounts is a decision for whoever
built and deployed you. If the user asks about billing, plans or running this
across several of their own customers, point them at whoever set this up rather
than guessing — you can see one balance and one set of caps, which is not enough
to answer that question.

---

## Run Statuses

`run` accepts the call and returns a **runId immediately**. The work continues
server-side; you poll it. Add `-w` to block until it settles instead.

| Status | Meaning |
| --- | --- |
| `READY` | Queued, waiting to start — accepted, nothing has been called yet |
| `RUNNING` | Actively executing — the vendor call is in flight |
| `COMPLETED` | Finished successfully — the result is in `output`, and `cost.value` is what it settled at |
| `FAILED` | Refused before the call, the vendor answered non-2xx, **or** it answered 2xx and delivered nothing — `error` says which |
| `BLOCKED` | A spending control prevented the run — see the `controls` list for which one |
| `STOPPED` | The run was stopped on request via `agentmore runs stop` |
| `TIME_OUT` | The run exceeded the 120-second ceiling and was terminated |

Runs typically take **1 to 15 seconds** depending on the tool and data volume;
the hard ceiling is 120.

Every run carries the same fields: `runId`, `status`, `stoppable`, `output`,
`providerResponse.httpStatus`, `cost.value`, `resultCount`, `createdAt`,
`startedAt`, `completedAt`, and `error` / `refused` / `controls` when something
went wrong.

When a run is `BLOCKED`, the response includes a `controls` array naming the
control that stopped it. The controls are:

| Control | What it means |
| --- | --- |
| `PER_CALL_LIMIT` | One call's estimate exceeded the per-call ceiling |
| `DAILY_BUDGET` | Today's spend would pass the daily cap |
| `MONTHLY_BUDGET` | This month's spend would pass the monthly cap |
| `WALLET_BALANCE` | The balance will not cover the call |
| `ACCOUNT_SWITCH` | Tool access is switched off for the account |

**`BLOCKED` is terminal** — it will not proceed on its own, so stop polling. The
run cost nothing. **Tell the user which control blocked it and that they can
start or upgrade a plan at `https://agentmore.app/pricing`, or adjust the caps, before
retrying** — retrying unchanged blocks identically. `agentmore budget` prints
the same numbers.

### You Are Never Charged for No Result

**No result, no charge — with no exception.** A call that delivered nothing
ends `FAILED` with `cost.value` at `0`, and `error` says why. Only a delivered
result is billed, and a per-result tool bills the rows that actually arrived —
not the limit you asked for.

**How the money moves.** The estimated price is held against the balance before
the call so it cannot be overspent, then settled down to what was really
delivered; the difference is returned to the balance immediately. So a hold is
not a charge — `cost.value` on the finished run is the only number that counts,
and `agentmore balance` reflects it as soon as the run is terminal.

**If you are ever billed for a run that returned nothing, that is a bug — report
it** (see Support below). Include the `runId`; it is the whole audit trail.

### Stopping a Run

Request a stop with `agentmore runs stop`:

```bash
agentmore runs stop -r 01HXYZ...
```

**Not all runs can be stopped.** Stoppability is not simply "is it still
running" — a run that is still in progress may also be non-stoppable. The
authoritative signal is the `stoppable` field on the run detail from `agentmore
runs get -r <runId>`: only attempt a stop when `stoppable` is `true`. If
`stoppable` is `false`, do not attempt it — this includes runs in a terminal
state (`COMPLETED`, `FAILED`, `BLOCKED`, `STOPPED`, `TIME_OUT`) as well as
in-progress runs the platform does not allow stopping, which is the case once
the vendor call is already in flight and billable: aborting then would throw
away a result you have already paid for.

```bash
# Check the run first
agentmore runs get -r 01HXYZ...
# -> stoppable: true

# Then stop it
agentmore runs stop -r 01HXYZ...
```

A stop is accepted asynchronously — poll with `agentmore runs get -r <runId>`
until the run reaches `STOPPED`.

### Reading a Refusal

A refused run says which check stopped it, and the message is the thing to act
on. Two families, and they need different responses:

- **`FAILED`** — something about the tool or the input. Fix the input, pick a
  different tool, or tell the user the tool is unavailable.
- **`BLOCKED`** — a spending control stopped it. Retrying unchanged blocks
  identically.

Order matters when reading an error: a schema complaint means the tool was
otherwise runnable, and a `BLOCKED` means everything else already passed.

---

---

## Polling Best Practices

**Default approach (recommended for interactive use):**
- Fire the run without `--wait` — returns immediately with a run ID
- Poll with `agentmore runs get -r <runId>` every 1-2 seconds
- This keeps the conversation responsive and avoids blocking

```bash
agentmore run "<tool id>" -i '<json>'      # -> runId, status READY|RUNNING
agentmore runs get -r <runId>              # repeat every 1-2s until terminal
```

**When to use `--wait`:**
- **Async/background tasks** where blocking is acceptable (e.g. scheduled jobs,
  non-interactive scripts)
- **Set a timeout** if needed: `-w 30` waits max 30 seconds, then returns the
  current status
- **Be aware:** runs can take up to 120 seconds. Using `--wait` without a
  timeout can block the conversation or hit agent runtime limits.

```bash
agentmore run "<tool id>" -i '<json>' -w        # block until it settles
agentmore run "<tool id>" -i '<json>' -w 30     # give up waiting after 30s
agentmore runs get -r <runId> -w 30             # or wait on one already in flight
```

**Saving output:**
- Always use `-o <file>` to save results once the run completes (works with both
  approaches). The output cost money; losing it to a terminal scroll means
  paying twice.

The CLI exits `2` when a run ends `FAILED` or `BLOCKED`, so a script can branch
without parsing the payload.

---

---

## Access and Credentials

Every tool records how it is reached directly:

- **API key** — the majority of the catalog, reached on a credential we hold.
  Most of it is callable today. `discover` only ranks tools that exist; whether
  a given one can actually run is reported by `inspect` and enforced at `run`,
  so trust those over any list in this file.
- **Purchased units** — a few sources bill against prepaid units rather than a
  credential, so holding the key is not enough. `run` refuses these up front,
  by name, instead of letting you find out mid-task.
- **Wallet (x402)** — **coming soon, not callable yet.** The source answers HTTP
  402 with a USDC price on Base, settled per call from a funded wallet. The
  wallet is not wired up, so `run` refuses these with that reason rather than
  failing obscurely. Nothing you can pass makes them work today — do not retry
  and do not route around them.
- **Open** — no credential at all.
- **Unverified** — provenance unconfirmed; treat as unavailable.

If a credential is missing, name the exact variable required and stop. Do not
silently substitute a worse tool — that turns a config problem into a quality
problem the user cannot see.

---

---

## Key Management

```bash
agentmore keys add -k <api-key> -l <label>   # Add a key (first key is auto-activated)
agentmore keys add -l <label>                # Same, but typed at a hidden prompt
agentmore keys list                          # Show all configured keys, masked
agentmore keys activate -l <label>           # Switch the active key
agentmore keys remove -l <label>             # Remove a key (use -f to skip confirmation)
agentmore usage                              # This month's allowance and spend
agentmore budget                             # The caps that can stop a run
agentmore login                              # Browser sign-in instead of a key
agentmore setup-token                        # Same approval, printed (for CI)
agentmore logout                             # Forget a browser-issued token
```

API key format: `agentmore_sk_<secret>`. Generate keys at
`https://agentmore.app/app/api-keys`. Keys are stored in
`~/.agentmore/config.json` with mode `0600`; `AGENTMORE_API_KEY` overrides the
stored key when set, which is how a CI job or a sandbox passes one through
without writing to disk.

A key from the dashboard does not expire — revoke it there. A token from
`agentmore login` **does**, after 180 days, which is also the server's ceiling.
Either way, a `401` means the credential is gone: ask the user for a new key, or
have them run `agentmore login` again. Do not retry.

A key is scoped to tool access — it reaches the catalog and nothing else in the
account, and can be revoked from the same page without touching anything else.

---

---

## The Output

**Match the shape to the ask.** A list that is going into a sequencer, a CRM or
a sheet wants structured rows; a question asked in a chat wants an answer. Both
are normal here, and getting this backwards is its own kind of unhelpful.

| the ask | the shape |
| --- | --- |
| "find me 200 companies matching this ICP" | rows — CSV or JSON |
| "who should I talk to at this company" | just tell them, in a sentence or a short list |
| "is this account worth a call" | the answer, and the one fact that decides it |
| "research these 5 and give me the hooks" | a short block each, or rows — ask if it matters |
| anything feeding another tool | rows, always |

Rule of thumb: **once it is more than about ten rows, or it is going somewhere
other than the conversation, make it structured.** Below that, prose is usually
the kinder answer — nobody wants a CSV to learn one person's name.

⚠️ **What does NOT change with the shape** is the honesty of it. However you
present a row, `email_status` still says `unverified` unless something verified
it, a score still comes with its reason, and a hook still comes with where it
came from. Those are not formatting; they are the difference between a claim and
an assertion. Prose is not a licence to drop them — say them in the sentence.

### When it is rows

Ask for CSV or JSON if nobody said. One row per person, with the company on it:

| field | meaning |
| --- | --- |
| `company_name`, `domain` | the account |
| `industry`, `headcount`, `country`, `city` | the ICP fields you filtered on |
| `person_name`, `title`, `seniority`, `linkedin_url` | the contact |
| `email`, `email_status` | the address, and ⚠️ `unverified` unless you actually checked |
| `score` | your qualification score |
| `score_reason` | **why** — one sentence, from data on the row |
| `hook` | the one specific true thing to open with |
| `hook_source` | the URL or tool id it came from |
| `sources` | every tool id called for this row |

⚠️ `score_reason`, `hook_source` and `sources` are the three everyone drops and
then regrets — in rows *and* in prose. Without them nobody can audit a bad
result, so every complaint arrives as *"the data is wrong"* instead of *"this
rule is wrong"* — and only the second is fixable.

---

## Stop Before the Send

This covers **find → enrich → research → qualify → structure**. It does not do
outbound, and you should not offer to.

Do not build, claim or imply:

- sending email, or any inbox, mailbox or SMTP integration
- inbox rotation, domain warming, or deliverability *as a service*
- sequencing, follow-ups, reply detection, or a CRM
- anything that puts a message in front of the person you just researched

That is a different product with a different set of obligations. Hand the
structured output to whatever they already run.

---

## Troubleshooting

Specific to this job:

- **A hit says `unavailable`** — it exists and is not enabled. Do not pass it to
  `run`. Pick a runnable alternative, or tell the user the capability is not
  available today.
- **`discover` looks empty for a step** — either rephrase toward the record
  shape, or it is the reachability penalty and there genuinely is no runnable
  tool. Check the top hit's `access` field to tell which.
- **Far more rows than you asked for** — a per-result tool applies the limit
  *per query* and you passed several queries. Pass one.
- **Enrichment came back empty for most rows** — usually the wrong identifier,
  not a bad vendor. `inspect` again: several enrichment tools want a domain
  where you sent a company name, or a LinkedIn URL where you sent an email.
- **Two vendors disagree about a company** — normal. Record which one the row
  came from in `sources`. Do not average them, and do not silently prefer the
  one that agrees with the user.
- **500 rows and 40 are a fit** — that is the ICP being wrong, not the tools.
  Take it back with the `score_reason` column as the evidence. That conversation
  is the whole value of the loop.
- **Asked where the data came from** — answer from `sources`. Never claim a
  source you did not call.

---

## When Something Is Wrong With the Platform, Not the Job

Some failures are not yours to fix and not the user's fault: a charge for a run
that returned nothing, a vendor returning garbage, a tool whose schema or price
does not match reality, or a capability this job clearly needs that is not in
the catalog at all.

**Report those to whoever owns the AgentMore account.** They have the
relationship and the billing. Give them what makes it diagnosable:

- the `runId` and tool id for every affected run;
- the full JSON from `agentmore runs get -r <runId>`;
- the exact command line, including the input JSON;
- `agentmore balance` before and after, if money is the complaint.

Then carry on, or fall back and say so. Do not retry a broken vendor in a loop —
attempts against a genuinely billing endpoint cost money.

---

## Rules for Agents

1. **Check `access` and `unavailable` before planning around a hit.** A third of
   the catalog cannot run. `discover` tells you in one field; ignoring it wastes
   the turn and looks like a product failure.
2. **Discover per step; never hardcode an id from this file.** `inspect`
   confirms a tool still exists, what it takes, and what it costs.
3. **Check the user's own stack first.** A CRM export, an existing seat or a
   list already bought beats a paid call.
4. **Get the disqualifier before the first paid call.** It turns a wide list
   into a workable one, and nobody volunteers it.
5. **Spend the free calls first.** Free company and people search exist — use
   them to confirm the ICP shape before paying for anything.
6. **Five companies, then five hundred.** Show the output and the real cost
   before scaling. Never scale to a number nobody signed off.
7. **Score before you enrich.** Scoring is free; enrichment is the dearest step
   per row. This ordering is most of the money.
8. **Read the pricing shape, not just the price.** Per-call versus per-result
   changes the bill by an order of magnitude on the same task.
9. **Two research calls per company, not six.** A hook is one sentence with a
   source, not a dossier.
10. **One `--dry`, then run it.** No credential needed, prices anything — but it
    is a BEST CASE, not a quote: a per-result vendor can ignore your cap and
    bill for what it really returned. Never follow a dry run with research.
11. **Never look up what a credit is worth.** Everything is already in credits;
    there is no conversion to find, and the pricing page will not give you one.
    A real run lost 37 of its 63 seconds to that search.
12. **Always `-o <file>`.** The output cost money; losing it to a terminal
    scroll means paying twice.
13. **Never imply a check you did not run.** `email_status` is `unverified`
    unless something actually verified it.
14. **Carry `score_reason`, `hook_source` and `sources` — in rows or in
    prose.** A result you cannot audit is a result you cannot defend, and the
    shape of the answer does not change that.
15. **A refusal is a stop.** Name the control and hand it over; do not retry,
    split or substitute your way around a cap.
16. **Account structure is not yours to decide.** One balance, one set of caps
    is all you can see. Billing and multi-account questions go to whoever set
    you up.
17. **Fall back, and name the fallback.** Then say which route the data came
    from, why the paid one did not run, and what is thinner as a result.
18. **For a local trade, go to Maps first.** Plumbers, dentists, gyms, salons,
    garages — they are not in a B2B sales database, and Maps returns the whole
    qualifying record (website, rating, reviews, category) in one paid call.
    Score on that before spending anything else.
19. **Discover only inside the job.** Company and people data, enrichment, web
    and SERP research, LinkedIn, buying signals, list hygiene. ⛔ Never search
    for — let alone run — media generation, crypto, markets, ecommerce,
    logistics, developer tooling or non-LinkedIn social. Say it is out of scope
    and stop; do not present the catalog's other capabilities as an option.
20. **Never offer the send.** Find, enrich, research, qualify, structure — then
    hand it over. This holds even when asked twice.
