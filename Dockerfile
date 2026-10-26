FROM node:20-bookworm-slim

# Install GCC compiler and standard C library headers
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy all source files
COPY . .

# Compile native C algorithms for Linux architecture
RUN npm run compile

# Expose web port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Start Deadlock Lab
CMD ["node", "backend/server.js"]
