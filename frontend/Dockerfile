FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

# Disable ESLint noise during build
ENV DISABLE_ESLINT_PLUGIN=true
ENV ESLINT_NO_DEV_ERRORS=true

# Use polling for file watching in Docker (prevents EMFILE errors)
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true
ENV GENERATE_SOURCEMAP=false
# Allow proxied hosts (nginx forwards external hostname)
ENV DANGEROUSLY_DISABLE_HOST_CHECK=true

EXPOSE 3000

CMD ["npm", "start"]
