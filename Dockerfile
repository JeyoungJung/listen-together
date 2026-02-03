# Use Node.js 20 slim (Debian-based)
FROM node:20-slim

# Install build dependencies and pnpm
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies with pnpm (more reliable than npm)
RUN pnpm install && \
    ls -la node_modules/.bin/ | head -10

# Copy source code
COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start the custom server
CMD ["node", "server.js"]
