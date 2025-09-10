# This is published to:
#   ghcr.io/elastic/elastic-otel-node/mockopampserver:latest
# Usage for local development:
#   docker build -t mockopampserver .
#   docker run --rm -it -p 4320:4320 --name mockopampserver mockopampserver
FROM node:24-alpine
RUN mkdir /app
WORKDIR /app
COPY lib ./lib/
COPY package.json ./
COPY package-lock.json ./
COPY README.md LICENSE NOTICE.md ./
RUN npm ci --omit=dev --ignore-scripts
EXPOSE 4320
CMD ["node", "lib/cli.js", "--hostname=0.0.0.0"]
