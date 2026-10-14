# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

ARG APP_ENV=prod
ENV VITE_MODE=$APP_ENV

WORKDIR /opt/plumber
COPY . ./
RUN npm install -g pnpm@12.1.0
# The token lives only in this RUN's environment, so no layer or config file stores it.
RUN --mount=type=secret,id=NPM_TASKFORCESH_TOKEN \
  pnpm_config__auth="{\"https://npm.taskforce.sh\":{\"@taskforcesh\":{\"authToken\":\"$(cat /run/secrets/NPM_TASKFORCESH_TOKEN)\"}}}" \
  pnpm install --frozen-lockfile
RUN pnpm run build
# `pnpm deploy` materializes a self-contained node_modules for one workspace
# package (resolving symlinks and workspace:* deps into real files), unlike
# npm's flat hoisting where backend's deps lived in the root node_modules.
# `dist/` is gitignored, so `pnpm deploy` won't carry it — copied separately below.
# --legacy avoids requiring inject-workspace-packages=true workspace-wide just for this.
# deploy can refetch @taskforcesh packages, and the install step's credentials are gone by now.
RUN --mount=type=secret,id=NPM_TASKFORCESH_TOKEN \
  pnpm_config__auth="{\"https://npm.taskforce.sh\":{\"@taskforcesh\":{\"authToken\":\"$(cat /run/secrets/NPM_TASKFORCESH_TOKEN)\"}}}" \
  pnpm --filter backend deploy --legacy --prod ./deploy/backend

FROM node:22-alpine AS main

WORKDIR /opt/plumber

COPY --from=build /opt/plumber/packages/backend/dist ./packages/backend/dist
COPY --from=build /opt/plumber/deploy/backend/package.json ./packages/backend/package.json
COPY --from=build /opt/plumber/deploy/backend/node_modules ./packages/backend/node_modules
COPY --from=build /opt/plumber/packages/frontend/dist ./packages/frontend/dist

EXPOSE 8080
CMD ["node", "packages/backend/dist/server.js"]