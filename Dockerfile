# Use Node.js 20 Alpine
FROM node:20-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json package-lock.json .npmrc ./

# Cache bust - change this to force fresh install
ARG CACHEBUST=1

# Install dependencies and verify
RUN echo "Installing dependencies..." && \
    npm ci --legacy-peer-deps && \
    echo "Verifying installation..." && \
    ls -la node_modules/ | head -20 && \
    ls -la node_modules/.bin/ | head -20 && \
    test -f node_modules/.bin/next && echo "next binary found!" || (echo "ERROR: next not found!" && exit 1)

# Copy source code
COPY . .

# Build Next.js using npx to ensure we find it
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start the custom server
CMD ["node", "server.js"]
