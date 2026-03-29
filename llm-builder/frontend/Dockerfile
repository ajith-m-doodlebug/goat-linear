# bookworm-slim (glibc): Next.js SWC on linux/arm64 fails on Alpine/musl (gnu binary symbol errors, musl optional often missing).
FROM node:20-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Dev stage: Linux npm ci baked at /built-deps; entrypoint copies into mounted volume when lock matches
# (avoids broken trees from npm install inside the volume). If lock differs from image, runs npm ci at start.
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
