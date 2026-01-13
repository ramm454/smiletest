# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Install Python and dependencies for AI models
RUN apk add --no-cache python3 py3-pip build-base
RUN python3 -m pip install --upgrade pip

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Install Python dependencies for AI
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Copy AI models
COPY ai-models ./ai-models

FROM node:18-alpine AS runner
WORKDIR /app

# Install Python runtime
RUN apk add --no-cache python3 py3-pip

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/ai-models ./ai-models
COPY --from=builder /app/scripts ./scripts

# Install Python dependencies
COPY --from=builder /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode!==200)throw new Error(r.statusCode)})"

CMD ["node", "dist/main.js"]