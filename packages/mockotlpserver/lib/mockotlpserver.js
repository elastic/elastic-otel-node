/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const luggite = require('./luggite');
const {HttpService} = require('./http');
const {GrpcService} = require('./grpc');
const {UiService} = require('./ui');
const {Printer} = require('./printers');

// Default hostname to 'localhost', because that is what `DEFAULT_COLLECTOR_URL`
// uses in the OTel core exporter packages. Note that 'localhost' can by IPv6
// '::1' or IPv4 '127.0.0.1', which can potentially cause confusion.
const DEFAULT_HOSTNAME = 'localhost';
const DEFAULT_HTTP_PORT = 4318;
const DEFAULT_GRPC_PORT = 4317;
const DEFAULT_UI_PORT = 8080;

/**
 * A "Printer" to pass on received data to `onTrace` et al callbacks given
 * to MockOtlpServer.
 */
class CallbackPrinter extends Printer {
    constructor(log, callbacks) {
        super(log);
        this._callbacks = callbacks;
    }
    printTrace(trace) {
        if (this._callbacks.onTrace) {
            this._callbacks.onTrace(trace);
        }
    }
    printMetrics(metrics) {
        if (this._callbacks.onMetrics) {
            this._callbacks.onMetrics(metrics);
        }
    }
    printLogs(logs) {
        if (this._callbacks.onLogs) {
            this._callbacks.onLogs(logs);
        }
    }
}

class MockOtlpServer {
    /**
     * @param {object} [opts]
     * @param {import('./luggite').Logger} [opts.log]
     * @param {string} [opts.logLevel] Optionally change the log level. This
     *      accepts any of the log level names supported by luggite. Typically
     *      one would use opts.log *or* opts.logLevel. The latter enables
     *      tweaking the log level without having to pass in a custom logger.
     * @param {Array<'http'|'grpc'|'ui'>} [opts.services] Zero or more of 'http', 'grpc',
     *      and 'ui'. If not provided, then defaults to starting all services.
     * @param {string} [opts.httpHostname] Default 'localhost'.
     * @param {number} [opts.httpPort] Default 4318. Use 0 to select a free port.
     * @param {string} [opts.grpcHostname] Default 'localhost'.
     * @param {number} [opts.grpcPort] Default 4317. Use 0 to select a free port.
     * @param {string} [opts.uiHostname] Default 'localhost'.
     * @param {number} [opts.uiPort] Default 8080. Use 0 to select a free port.
     * @param {Function} [opts.onTrace] Called for each received trace service request.
     * @param {Function} [opts.onMetrics] Called for each received metrics service request.
     * @param {Function} [opts.onLogs] Called for each received logs service request.
     */
    constructor(opts) {
        opts = opts ?? {};
        this._log = opts.log ?? luggite.createLogger({name: 'mockotlpserver'});
        if (opts.logLevel != null) {
            this._log.level(opts.logLevel);
        }
        this._services = opts.services ?? ['http', 'grpc', 'ui'];
        this._httpHostname = opts.httpHostname ?? DEFAULT_HOSTNAME;
        this._httpPort = opts.httpPort ?? DEFAULT_HTTP_PORT;
        this._grpcHostname = opts.grpcHostname ?? DEFAULT_HOSTNAME;
        this._grpcPort = opts.grpcPort ?? DEFAULT_GRPC_PORT;
        this._uiHostname = opts.uiHostname ?? DEFAULT_HOSTNAME;
        this._uiPort = opts.uiPort ?? DEFAULT_UI_PORT;

        this._printer = new CallbackPrinter(this._log, {
            onTrace: opts.onTrace,
            onMetrics: opts.onMetrics,
            onLogs: opts.onLogs,
        });
        this._printer.subscribe();

        this._httpServer = null;
        this.httpUrl = null;
        this._grpcServer = null;
        this.grpcUrl = null;
        this._uiServer = null;
        this.uiUrl = null;
    }

    async start() {
        for (let service of this._services) {
            switch (service) {
                case 'http':
                    // Start a server which accepts incoming OTLP/HTTP calls and publishes
                    // received request data to the `otlp.*` diagnostic channels.
                    // Handles `OTEL_EXPORTER_OTLP_PROTOCOL=http/proto` and
                    // `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`.
                    this._httpService = new HttpService({
                        log: this._log,
                        hostname: this._httpHostname,
                        port: this._httpPort,
                    });
                    await this._httpService.start();
                    this.httpUrl = this._httpService.url;
                    this._log.info(`OTLP/HTTP listening at ${this.httpUrl}`);
                    break;

                case 'grpc':
                    // Start a server which accepts incoming OTLP/gRPC calls and publishes
                    // received request data to the `otlp.*` diagnostic channels.
                    // Handles `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`.
                    // NOTE: to debug read this: https://github.com/grpc/grpc-node/blob/master/TROUBLESHOOTING.md
                    this._grpcService = new GrpcService({
                        hostname: this._grpcHostname,
                        port: this._grpcPort,
                    });
                    await this._grpcService.start();
                    this.grpcUrl = this._grpcService.url;
                    this._log.info(`OTLP/gRPC listening at ${this.grpcUrl}`);
                    break;

                case 'ui':
                    this._uiService = new UiService({
                        log: this._log,
                        hostname: this._uiHostname,
                        port: this._uiPort,
                    });
                    await this._uiService.start();
                    this.uiUrl = this._uiService.url;
                    this._log.info(`UI listening at ${this.uiUrl}`);
                    break;
            }
        }
    }

    async close() {
        if (this._httpService) {
            await this._httpService.close();
        }
        if (this._grpcService) {
            await this._grpcService.close();
        }
        if (this._uiService) {
            await this._uiService.close();
        }
    }
}

module.exports = {
    DEFAULT_HOSTNAME,
    MockOtlpServer,
};
