FROM node:18-alpine as build

WORKDIR /opt/plumber
COPY . ./
RUN npm ci
RUN npm run build
RUN npm prune --production

FROM build

WORKDIR /opt/plumber

COPY --from=build /opt/plumber/packages/backend/dist ./packages/backend/dist
COPY --from=build /opt/plumber/packages/backend/package.json ./packages/backend
COPY --from=build /opt/plumber/packages/web/build ./packages/web/build
COPY --from=build /opt/plumber/node_modules ./node_modules
COPY --from=build /opt/plumber/package.json ./

EXPOSE 8080
CMD ["npm", "start"]