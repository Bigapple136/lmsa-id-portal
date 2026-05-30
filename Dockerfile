FROM node:20-alpine AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build /app/node_modules ./node_modules
COPY backend/ .
USER appuser
EXPOSE 4000
ENV NODE_ENV=production
CMD ["node", "cluster.js"]
