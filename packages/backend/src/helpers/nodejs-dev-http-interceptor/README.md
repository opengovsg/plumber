# Node.js dev HTTP interceptor

Rewrites outgoing HTTP requests on dev only. The engine (`engine/`) patches `http.request`, `https.request` and `fetch` once, then applies a list of rules.

## Add a rule

1. Create a `rules/<name>/` directory.
2. Export the marker the calling code will send (e.g. a header name) from `rules/<name>/prod-constants.ts`. Production code imports it, so the file must import nothing.
3. Export the `DevRequestRule` from `rules/<name>/index.ts`, with its tests in `rules/<name>/__tests__/`.
4. Register the rule in `DEV_REQUEST_RULES` in `rules/index.ts`.
5. Make the calling code send the marker only when `appConfig.isDev` is true.

Do not patch `http`, `https` or `fetch` anywhere else. Rules must not import `engine/` or another rule.

## Matching requests

The engine sees every request in the process, including other libraries' requests. So `isApplicableRequest` must match only on a marker the calling code adds on purpose, such as a header or query param. Never match on URL or host alone.

## How the engine applies rules

- Matching rules run in `DEV_REQUEST_RULES` order. The engine calls each rule's `isApplicableRequest` just before that rule runs, so an earlier rule can change what a later rule matches on.
- The engine sends the request as the rules leave it. A rule that should hide its marker from the server must delete it.
- Rules get a copy of the caller's headers, so they can edit `request.headers` freely.
- To send `http.request` calls through HTTP(S)_PROXY and NO_PROXY, set `request.agent = getEnvProxyAgent(request.url.protocol)`. `fetch` ignores `agent` and uses proxy env vars only when `NODE_USE_ENV_PROXY=1`.
- If the engine cannot parse a request, it sends the request unchanged and logs the error once to `console.error`.
- `http.get` and `https.get` bypass the engine, because Node's implementation calls its internal `request`.
- Dependencies must be `backend` devDependencies. `index.ts` requires `engine/` lazily, so production never loads them.
