
FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules
# Alpine uses apk
RUN apk add --no-cache python3 make g++

# Copy package.json (Standalone context)
COPY package*.json ./

# Install dependencies with verbose logging and clean install
# Increased timeout to prevent freeze on slow networks/Docker-Windows
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm install --verbose

# Copy source
COPY . .

# Expose Medusa port
EXPOSE 9000

# Start command
CMD ["npm", "run", "dev"]
