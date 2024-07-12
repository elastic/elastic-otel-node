# Usage:
#   docker build -t mockotlpserver .
#   docker run --rm -it -p 4317:4317 -p 4318:4318 --name mockotlpserver mockotlpserver
#
# Or see "share/k8s/README.md" for using it with Kubernetes.
FROM node:18-alpine
RUN mkdir /app
WORKDIR /app
COPY lib ./lib/
COPY opentelemetry ./opentelemetry/
COPY ui ./ui/
COPY package.json ./
COPY README.md LICENSE NOTICE.md ./
RUN npm install
EXPOSE 4317 4318
CMD ["npm", "start", "--", "--hostname=0.0.0.0"]
