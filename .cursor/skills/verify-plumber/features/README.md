# Plumber verification map

This directory is the maintained source for verifying user-facing Plumber behavior. Read this index, then follow the matching feature file.

## Baseline preconditions

- Run `control-plumber doctor` and require `healthy` plus the URL from this launch.
- Use the email from `control-plumber email`. It ends in `.gov.sg`.
- The database starts empty for that instance.
- Chrome is the one `launch` started. Do not attach to another browser.
- Never drive an instance that was not started by this verification run.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors.
- Treat every command as literal. Keep quoted names unchanged.
- Run browser actions through `control-plumber browser`.
- Restore nothing in the shared dev database. This instance is disposable.
- Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot.
- Mutation proof includes a reload that shows the saved value.
- Record the feature id and the entry point used with every artifact.
- Report an unreachable path with the command you ran and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short ids with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-plumber` starts with `Preconditions:` and pairs each action with a command and an observable result.
4. `Gotchas` lists traps that can waste or invalidate a run.

## Features

- [Landing](./landing.md) covers the public home page and the path into sign-in.
- [Sign in](./sign-in.md) covers email OTP sign-in on a fresh user.
- [Create a pipe](./create-pipe.md) covers naming a pipe from the empty pipes page and reopening it.
- [Templates](./templates.md) covers the templates list for a signed-in user.
- [Executions](./executions.md) covers the executions list before any pipe exists.
