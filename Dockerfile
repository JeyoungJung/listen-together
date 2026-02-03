# Use Node.js 20 slim (Debian-based, more stable npm)
FROM node:20-slim

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Use npm with --ignore-scripts first, then rebuild
RUN npm install --legacy-peer-deps --ignore-scripts && \
    npm rebuild && \
    ls -la node_modules/.bin/ | head -10

# Copy source code
COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN ./node_modules/.bin/next build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start the custom server
CMD ["node", "server.js"]
