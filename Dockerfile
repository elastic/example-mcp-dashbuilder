# Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
# or more contributor license agreements. Licensed under the Elastic License 2.0;
# you may not use this file except in compliance with the Elastic License 2.0.

# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY setup/package.json setup/
COPY server/package.json server/
COPY preview/package.json preview/
RUN npm install
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/shared/package.json shared/
COPY --from=build /app/setup/package.json setup/
COPY --from=build /app/server/package.json server/
COPY --from=build /app/preview/package.json preview/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/setup/dist ./setup/dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/preview/dist ./preview/dist

EXPOSE 3001
CMD ["node", "server/dist/index.js", "--http"]
