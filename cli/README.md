# @agentmore/cli

One command over a catalog of ~1,700 external endpoints — social scraping, web
search, company and person enrichment, SEO, commerce, media generation — each
with a real input schema and a known price.

```bash
npm i -g @agentmore/cli
agentmore setup
agentmore discover -q "tiktok comments on a video"
```

Reach for it *before* writing a scraper or signing up for an API. Something in
the catalog almost certainly already does the job.

## The workflow

```bash
agentmore discover -q "<what you need>"     # ranks the catalog, spends nothing
agentmore inspect "<tool id>"               # schema, price, caveats
agentmore run "<tool id>" -i '{…}' --dry    # price it without spending
agentmore run "<tool id>" -i '{…}' -w       # execute it
```

Everything here needs an API key, discovery included — `agentmore setup` first.
Discovery and inspection still **spend nothing** and work on an empty balance;
the key says who is asking, it does not buy the lookup. Only `run` spends.

⚠️ Discovery required no key before 0.3.0. Upgrade: a 0.2.x client sends none
and gets a bare `401` from `discover` and `inspect`.

## Commands

```
Setup      setup · keys add|list|activate|remove · login · logout · setup-token
Find       discover · inspect · stats · platforms
Run        estimate · run
Account    balance · usage · runs list|get|stop
Skills     skills · skill · install
```

Every command takes `--help`. Add `-j` for JSON.

## Skills

A **tool** is one priced endpoint you run. A **skill** is a file your agent
reads to learn a whole job end to end — a process rather than a call.

```bash
agentmore skills                 # what is published
agentmore install "ui"           # write its file into your agent
```

Most work is a tool. Skills exist for the few capabilities that aren't.

## Paying for it

Everything is priced in **US dollars**. Most tools cost well under a cent, so
small decimals are normal — `$0.0015` is a real price, not a rounding error.
The catalog spans `$0.00015` to `$5.60`; the median tool is `$0.003`.

Every account starts with **$0.50 of free balance**. After that it is pay as you
go: add funds with a card at <https://agentmore.app/app/wallet> and spend what
you use. There is no plan, no tier and no monthly allowance, so running out is a
hard stop until you add funds.

Optional **auto-reload** — "when my balance drops below $X, charge me $Y again" —
keeps a long agent run from stalling halfway.

An agent with no account at all can pay per call over x402 or MPP: no signup, no
API key. That path is for agents that pay per call, and nothing has settled
through it yet.

Every call is priced before it runs, refused when the worst case can't be
priced, and capped per call and per day. You are never charged for no result.

## Environment

| Variable | Meaning |
| --- | --- |
| `AGENTMORE_API_KEY` | Use this key instead of the stored one |
| `AGENTMORE_API_BASE` | Point at another host (must be https) |
| `NO_COLOR=1` | Disable ANSI colour |

## Licence

MIT — see [LICENSE](./LICENSE). Source:
[github.com/agentmore/agentmore](https://github.com/agentmore/agentmore).
Bugs and questions: [issues](https://github.com/agentmore/agentmore/issues),
or `rick@agentmore.app`.
