FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# Dev stage: deps only, no build; use with volume mount and `npm run dev`
# On startup we run npm install so the mounted node_modules volume is populated (empty on first run).
FROM node:20-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json* ./
EXPOSE 3000
ENV PORT=3000
CMD ["sh", "-c", "npm install && exec npm run dev"]

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
