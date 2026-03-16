FROM node:20-alpine AS base

WORKDIR /app

# Dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Build
COPY . .
RUN npm run build

EXPOSE 3000

# Production: serve built app
CMD ["npm", "start"]
