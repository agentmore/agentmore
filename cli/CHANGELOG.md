# Changelog

All notable changes to `@agentmore/cli`. This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] — 2026-08-12

### Fixed

- **`--dry-run` and `--dryrun` now work.** Only `--dry` was recognised, and
  unknown flags parse silently, so the most likely spelling of the flag executed
  the tool against the vendor and charged the wallet. All three spellings now
  mean the same thing.
- **`files get` refuses to overwrite an existing local file** unless `--force`,
  matching `install`. `-o` is optional, so the default target is the remote
  basename in the working directory — `files get "docs/README.md"` could destroy
  a local `README.md` without asking.
- **`files mv` refuses to replace an existing destination** unless `--force`. A
  move is two destructive acts under one name, and the file it would destroy is
  one you never named.
- **`login --days` no longer misreports the expiry.** The server caps a token at
  180 days; the CLI printed whatever you asked for, so `--days 365` announced an
  expiry that was not true and `--days abc` printed `NaN`.
- The polling hint suggests a run-unique output file rather than a shared
  `out.json`, which two concurrent runs would overwrite.

### Changed

- `agentmore usage` help no longer claims the allowance resets on the 1st — it
  follows your subscription's own renewal date, and the reset date is printed
  with the figures.
- `agentmore budget` no longer advertises a monthly cap it could not display.
  The monthly ceiling is real and is reported by `agentmore usage`.
- Daily and per-call caps are described as per-account, because that is what
  they are: no other account's usage moves your numbers.
- Removed `-f` from the documented `keys remove` usage — it was never
  implemented, and `-f` already means "input from a file" everywhere else.
- `-v, --version` is documented in the flags list. It was always implemented.

## [0.1.0] — 2026-08-09

First public release. One command over the external-tool catalog: `discover` →
`inspect` → `run`, plus the file store, skills and account commands.

Replaces `@noctrn/supertool`, which was a second binary, a second install and a
second skill file on top of this one. Same catalog, same prices, same wallet,
same run semantics.

[0.1.4]: https://github.com/Rickboers/agentmore-cli/releases/tag/v0.1.4
[0.1.0]: https://www.npmjs.com/package/@agentmore/cli/v/0.1.0
