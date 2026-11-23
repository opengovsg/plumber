# Plumber feature map

Each page covers one user journey: how a user reaches it, what each step shows and the traps. Start every journey from [Drive the Plumber UI](../drive-ui.md).

## Page format

Each page starts with an H1 and one paragraph on the user-visible behavior. Then it has four H2 sections in this order:

1. `Sub-features`: short ids, one line each.
2. `How to get to it`: every user entry point.
3. `Steps`: preconditions, then each action with its expected result.
4. `Gotchas`: traps that waste or invalidate a run.

Name controls by role and accessible name, so any browser tool can follow the steps.

## Reporting

- Record the sub-feature id and the entry point with every proof.
- Report an unreachable path with the unmet precondition.
- Do not report an entry point as verified through a different path.

## Features

- [Landing](./landing.md): the public home page and the path to sign-in.
- [Sign in](./sign-in.md): email OTP sign-in for a new user.
- [Create a pipe](./create-pipe.md): name a pipe from the empty pipes page and reopen it.
- [Templates](./templates.md): the templates list.
- [Executions](./executions.md): the executions page before any pipe exists.
- [Toolbox placement](./toolbox-placement.md): which Toolbox actions the step picker allows inside If and Repeat blocks.
