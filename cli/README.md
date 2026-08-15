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
agentmore discover -q "<what you need>"     # free — ranks the catalog
agentmore inspect "<tool id>"               # free — schema, price, caveats
agentmore run "<tool id>" -i '{…}' --dry    # price it without spending
agentmore run "<tool id>" -i '{…}' -w       # execute it
```

Discovery and inspection are free and need no key. `run` spends.

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

Everything is priced in **credits**. Most tools cost well under one credit, so
decimals are normal — `0.15 credits` is a real price, not a rounding error.

Every account starts with 50 free credits. After that, credits come from a plan
and only from a plan — there is no top-up, so running out is a hard stop until
the plan renews.

| plan | price | credits a month |
| --- | --- | --- |
| Free | — | 50 on signup |
| Start | $9 | 1,000 |
| Pro | $19 | 2,500 |
| Master | $25 | 3,500 |

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
