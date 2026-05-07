FROM node:24-alpine

WORKDIR /app

# Dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Pre-built documentation index
COPY data/index.json ./data/index.json

CMD ["node", "dist/ui/index.js"]
