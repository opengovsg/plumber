# syntax=docker/dockerfile:1
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 as build # 22-alpine

ARG APP_ENV=prod
ENV VITE_MODE=$APP_ENV

WORKDIR /opt/plumber
COPY . ./
RUN npm install -g pnpm@12.1.0
RUN --mount=type=secret,id=NPM_TASKFORCESH_TOKEN \
  pnpm config set "//npm.taskforce.sh/:_authToken" "$(cat /run/secrets/NPM_TASKFORCESH_TOKEN)" && \
  pnpm install --frozen-lockfile
RUN pnpm run build
# `pnpm deploy` materializes a self-contained node_modules for one workspace
# package (resolving symlinks and workspace:* deps into real files), unlike
# npm's flat hoisting where backend's deps lived in the root node_modules.
# `dist/` is gitignored, so `pnpm deploy` won't carry it — copied separately below.
# --legacy avoids requiring inject-workspace-packages=true workspace-wide just for this.
RUN pnpm --filter backend deploy --legacy --prod ./deploy/backend

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 as main # 22-alpine

WORKDIR /opt/plumber

COPY --from=build /opt/plumber/packages/backend/dist ./packages/backend/dist
COPY --from=build /opt/plumber/deploy/backend/package.json ./packages/backend/package.json
COPY --from=build /opt/plumber/deploy/backend/node_modules ./packages/backend/node_modules
COPY --from=build /opt/plumber/packages/frontend/dist ./packages/frontend/dist

EXPOSE 8080
CMD ["node", "packages/backend/dist/server.js"]