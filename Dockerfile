FROM node:24-alpine AS builder

WORKDIR /app

# llng-mcp is launched via `npx llng-mcp` at runtime, not imported. The
# `file:../llng-mcp` entry in package.json is for local dev and breaks Docker
# builds (the parent dir isn't in the build context), so strip it out.
COPY package.json package-lock.json* ./
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json')); delete p.dependencies['llng-mcp']; fs.writeFileSync('package.json', JSON.stringify(p,null,2));" \
 && rm -f package-lock.json \
 && npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build


FROM node:24-alpine

WORKDIR /app

COPY package.json ./
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json')); delete p.dependencies['llng-mcp']; fs.writeFileSync('package.json', JSON.stringify(p,null,2));" \
 && npm install --omit=dev --no-audit --no-fund \
 && npm install -g llng-mcp \
 && npm cache clean --force

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/ui/index.js"]
