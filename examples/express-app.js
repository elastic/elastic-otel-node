// Usage:
//  node -r @elastic/opentelemetry-node/start.js express-app.js
//  curl -i http://127.0.0.1:3000/ping
//  curl -i http://127.0.0.1:3000/hi/Bob
//  curl -i http://127.0.0.1:3000/api/v1/things -X POST -d '"my-thing"' -H content-type:application/json
//  curl -i http://127.0.0.1:3000/api/v1/things

const crypto = require('crypto');
const express = require('express');

const things = [];

const app = express();
app.get('/ping', (_req, res) => {
    res.send('pong');
});
app.get('/hi/:name', (req, res) => {
    res.send(`Hi, ${req.params?.name || 'buddy'}.`);
});
const apiRouter = express.Router();
apiRouter.use(express.json({strict: false}));
apiRouter.get('/things', (req, res) => {
    res.send(things);
});
apiRouter.post('/things', (req, res) => {
    things.push({
        id: crypto.randomBytes(8).toString('hex'),
        thing: req.body,
    });
    res.send({result: 'ok'});
});
app.use('/api/v1', apiRouter);
app.use(function onError(err, req, res, next) {
    console.log('express-app err:', err);
    res.status(500);
    res.send('internal error');
});

const server = app.listen(3000, '127.0.0.1', function () {
    console.log('listening at:', server.address());
});
