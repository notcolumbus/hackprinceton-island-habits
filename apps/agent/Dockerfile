FROM node:22-slim AS build
WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund --omit=optional

COPY src ./src
RUN npm run build && npm prune --omit=dev --omit=optional

FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
