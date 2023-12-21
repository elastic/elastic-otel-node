const path = require('path');

const httpServer = require('http-server');

const {UiPrinter} = require('./printers');

// helper functions

/**
 *
 * @param {Object} opts
 * @param {import('./luggite').LoggerInstance} opts.log
 * @param {string} opts.hostname
 * @param {number} opts.port
 */
function startUi(opts) {
    const {log, hostname, port} = opts;
    const server = httpServer.createServer({
        root: path.join(__dirname, '/../ui'),
    });

    server.listen(port, hostname, function () {
        const endpoint = `http://${hostname}:${port}`;
        log.info(`UI listening at ${endpoint}`);
    });

    // Use specific printer for UI
    const printer = new UiPrinter();
    printer.subscribe();
}

module.exports = {
    startUi,
};
