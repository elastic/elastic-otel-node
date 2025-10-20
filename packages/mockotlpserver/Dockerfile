# Usage:
#   docker build -t mockotlpserver .
#   docker run --rm -it -p 4317:4317 -p 4318:4318 --name mockotlpserver mockotlpserver
#
# Or see "share/k8s/README.md" for using it with Kubernetes.
FROM node:25-alpine
RUN mkdir /app
WORKDIR /app
COPY lib ./lib/
COPY opentelemetry ./opentelemetry/
COPY ui ./ui/
COPY db ./db/
COPY package.json ./
COPY package-lock.json ./
COPY README.md LICENSE NOTICE.md ./
RUN npm ci --omit=dev --ignore-scripts
EXPOSE 4317 4318
CMD ["node", "lib/cli.js", "--hostname=0.0.0.0"]
