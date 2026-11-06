# The deployable unit: the API server plus the built client on one port.
# Stage 1 type-checks and builds the client; stage 2 carries only runtime
# dependencies, the server source (Node 24 runs it directly) and dist/client.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/notes.db STATIC_DIR=/app/dist/client
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY contracts ./contracts
COPY server ./server
COPY --from=build /app/dist/client ./dist/client
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/src/index.ts"]
