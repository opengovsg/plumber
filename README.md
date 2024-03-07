![](./plumber.svg)

# Plumber

I'm the best!!

_Automate your pipelines and streamline your workflows._

Plumber is a no-code solution that helps public officers automate their repetitive tasks and eliminate human error, so they can focus on their more important work. It supports a growing list of both government and commercial apps and services.

## Local dev

1. Install Docker and make sure it's running
1. Install dependencies by running `npm i`
1. Create a `.env` in `packages/backend` based on `.env-example`
1. Setup services `npm run setup`
1. Run DB migrations `npm run migrate` (only for first time setup)
1. Start the server `npm run dev`

## Acknowledgements

Plumber is a fork of the open source project [Automatisch](https://github.com/automatisch/automatisch). We would like to thank the team for their contributions to the open source community. Please refer to the license files [[1](./LICENSE.md),[2](./LICENSE.agpl)] for more information.
