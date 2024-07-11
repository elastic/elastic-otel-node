# Vanilla usage in Docker:
#    docker build -t example-app-manual .
#    docker run --rm -it -p 3000:3000 example-app-manual
#    curl -i http://127.0.0.1:3000/ping
FROM node:18-alpine
RUN mkdir /app
WORKDIR /app
COPY app.js package.json ./
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]
