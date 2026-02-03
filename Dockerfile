# Use Node.js 20 Alpine
FROM node:20-alpine

# Install build dependencies and yarn
RUN apk add --no-cache python3 make g++ && \
    corepack enable && \
    corepack prepare yarn@stable --activate

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies with yarn (more stable than npm in CI)
RUN yarn install && \
    echo "Verifying installation..." && \
    ls -la node_modules/.bin/ | head -10 && \
    test -f node_modules/.bin/next && echo "next binary found!"

# Copy source code
COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start the custom server
CMD ["node", "server.js"]
