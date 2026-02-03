# Use Node.js 20 Alpine
FROM node:20-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files (including fresh package-lock.json)
COPY package.json package-lock.json .npmrc ./

# Install dependencies with ci for reproducible builds
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start the custom server
CMD ["node", "server.js"]
