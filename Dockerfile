# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim as build

ARG APP_ENV=prod
ENV VITE_MODE=$APP_ENV

WORKDIR /opt/plumber
COPY . ./
RUN npm install -g npm@11.19.0
RUN --mount=type=secret,id=NPM_TASKFORCESH_TOKEN \
  (export NPM_TASKFORCESH_TOKEN=$(cat /run/secrets/NPM_TASKFORCESH_TOKEN); npm ci)
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim as main

WORKDIR /opt/plumber

COPY --from=build /opt/plumber/packages/backend/dist ./packages/backend/dist
COPY --from=build /opt/plumber/packages/backend/package.json ./packages/backend
COPY --from=build /opt/plumber/packages/frontend/dist ./packages/frontend/dist
COPY --from=build /opt/plumber/node_modules ./node_modules
COPY --from=build /opt/plumber/package.json ./

EXPOSE 8080
CMD ["npm", "start"]