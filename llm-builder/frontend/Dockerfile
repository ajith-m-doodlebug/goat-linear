FROM node:20-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Inlined into the client bundle at build — runtime `web` env cannot fix wrong API host.
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_API_PORT=8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_PORT=$NEXT_PUBLIC_API_PORT
RUN npm run build


FROM node:20-bookworm-slim AS dev
WORKDIR /built-deps
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund \
  && sha256sum package-lock.json | awk '{print $1}' > /built-deps/.lock-sha

WORKDIR /app
COPY docker-entrypoint-dev.sh /usr/local/bin/docker-entrypoint-dev.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-dev.sh
ENV NODE_ENV=development
EXPOSE 3000
ENV PORT=3000
ENTRYPOINT ["docker-entrypoint-dev.sh"]
CMD ["npm", "run", "dev"]

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
