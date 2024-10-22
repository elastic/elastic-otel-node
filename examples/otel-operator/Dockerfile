# Vanilla usage in Docker:
#    docker build -t myapp .
#    docker run --rm -it -p 3000:3000 myapp
#    curl -i http://127.0.0.1:3000/ping
FROM node:18-alpine
RUN mkdir /app
WORKDIR /app
COPY app.js package.json ./
RUN npm install
EXPOSE 3000
CMD ["node", "app.js"]
