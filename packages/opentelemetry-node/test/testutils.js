'use strict';

// A dumping ground for testing utility functions.

const assert = require('assert');
const fs = require('fs');
const {execFile} = require('child_process');

const moduleDetailsFromPath = require('module-details-from-path');
const semver = require('semver');

const {
    MockOtlpServer,
    normalizeLogs,
    normalizeTrace,
    normalizeMetrics,
} = require('@elastic/mockotlpserver');

/**
 * Lookup the property "str" (given in dot-notation) in the object "obj".
 * If the property isn't found, then `undefined` is returned.
 *
 * @param {Object} obj
 * @param {string} str
 * @returns {any}
 */
function dottedLookup(obj, str) {
    var o = obj;
    var fields = str.split('.');
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        if (!Object.prototype.hasOwnProperty.call(o, field)) {
            return undefined;
        }
        o = o[field];
    }
    return o;
}

/**
 * Return the first element in the array that has a `key` with the given `val`;
 * or if `val` is undefined, then the first element with any value for the given
 * `key`.
 *
 * The `key` maybe a nested field given in dot-notation, for example:
 * 'context.db.statement'.
 *
 * @param {Array<any>} arr
 * @param {string} key
 * @param {any} val
 * @returns {any}
 */
function findObjInArray(arr, key, val) {
    let result = null;
    arr.some(function (elm) {
        const actualVal = dottedLookup(elm, key);
        if (val === undefined) {
            if (actualVal !== undefined) {
                result = elm;
                return true;
            }
        } else {
            if (actualVal === val) {
                result = elm;
                return true;
            }
        }
        return false;
    });
    return result;
}

/**
 * Same as `findObjInArray` but return all matches instead of just the first.
 *
 * @param {Array<any>} arr
 * @param {string} key
 * @param {any} val
 * @returns {any}
 */
function findObjsInArray(arr, key, val) {
    return arr.filter(function (elm) {
        const actualVal = dottedLookup(elm, key);
        if (val === undefined) {
            if (actualVal !== undefined) {
                return true;
            }
        } else {
            if (actualVal === val) {
                return true;
            }
        }
        return false;
    });
}

/**
 * "Safely" get the version of the given package, if possible. Otherwise return
 * null.
 * Here "safely" means avoiding `require("$packageName/package.json")` because
 * that can fail if the package uses an old form of "exports"
 * (e.g. https://github.com/elastic/apm-agent-nodejs/issues/2350).
 *
 * @param {string} packageName
 * @returns {string | null}
 */
function safeGetPackageVersion(packageName) {
    let file;
    try {
        file = require.resolve(packageName);
    } catch (_err) {
        return null;
    }

    // Use the same logic as require-in-the-middle for finding the 'basedir' of
    // the package from `file`.
    const details = moduleDetailsFromPath(file);
    if (!details) {
        return null;
    }

    try {
        const pkgContents = fs.readFileSync(details.basedir + '/package.json', {
            encoding: 'utf-8',
        });
        return JSON.parse(pkgContents).version;
    } catch (_err) {
        return null;
    }
}

// Match ANSI escapes (from https://stackoverflow.com/a/29497680/14444044).
const ANSI_RE =
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g; /* eslint-disable-line no-control-regex */

/**
 * Format the given data for passing to `t.comment()`.
 *
 * - t.comment() wipes leading whitespace. Prefix lines with '|' to avoid
 *   that, and to visually group a multi-line write.
 * - Drop ANSI escape characters, because those include control chars that
 *   are illegal in XML. When we convert TAP output to JUnit XML for
 *   Jenkins, then Jenkins complains about invalid XML. `FORCE_COLOR=0`
 *   can be used to disable ANSI escapes in `next dev`'s usage of chalk,
 *   but not in its coloured exception output.
 */
function formatForTComment(data) {
    return (
        data
            .toString('utf8')
            .replace(ANSI_RE, '')
            .trimRight()
            .replace(/\r?\n/g, '\n|') + '\n'
    );
}

/**
 * @param {string} a
 * @returns {string}
 */
function quoteArg(a) {
    if (a.includes("'")) {
        return "'" + a.replace("'", "'\\''") + "'";
    } else if (a.includes('"') || a.includes('$')) {
        return "'" + a + "'";
    } else if (a.includes(' ')) {
        return '"' + a + '"';
    } else {
        return a;
    }
}

/**
 * @param {string[]} argv
 * @returns {string}
 */
function quoteArgv(argv) {
    return argv.map(quoteArg).join(' ');
}

/**
 * Returns a representation of the environment variables in string type
 * quoting them if the values have certain characters
 *
 *    process.env = {
 *        OTEL_SERVICE_NAME: 'my service',
 *        OTEL_LOG_LEVEL: 'trace',
 *    };
 *
 *    console.log(quoteEnv);
 *    // prints: OTEL_SERVICE_NAME="my service" OTEL_LOG_LEVEL=trace
 *
 * @param {NodeJS.ProcessEnv | undefined} env
 * @returns {string}
 */
function quoteEnv(env) {
    if (!env) {
        return '';
    }
    return Object.keys(env)
        .map((k) => {
            return `${k}=${quoteArg(env[k])}`;
        })
        .join(' ');
}

// TODO: move this types to packages/mockotlpserver/lib/normalize.js
/**
 * @typedef {Object} DataPointDouble
 * @property {string} startTimeUnixNano
 * @property {string} timeUnixNano
 * @property {number} asDouble
 * @property {Record<string, any} [attributes]
 */
/**
 * @typedef {Object} GaugeMetricData
 * @property {DataPointDouble[]} dataPoints
 */
/**
 * @typedef {Object} SumMetricData
 * @property {DataPointDouble[]} dataPoints
 */
/**
 * @typedef {Object} CollectedMetric
 * @property {string} name
 * @property {string} description
 * @property {string} unit
 * @property {GaugeMetricData} [gauge]
 * @property {SumMetricData} [sum]
 */

/**
 * CollectorStore represents a place where all observability data is saved.
 * From that store we can get all info sent from the agent to the server:
 * - traces
 * - metrics
 * - logs
 *
 * TODO: these types don't represent to added 'resource' and 'scope' properties.
 * TODO: This LogRecord doesn't include `traceId` et al, because there are 3 LogRecord classes: protos, api-logs, sdk-logs.
 *
 * @typedef {Object} CollectorStore
 * @property {import('@opentelemetry/api').Span[]} sortedSpans
 * @property {CollectedMetric[]} metrics
 * @property {import('@opentelemetry/api-logs').LogRecord[]} logs
 */

// Collect data sent to the mock OTLP server and provide utilities
// for using that data in tests.
class TestCollector {
    constructor() {
        this.rawTraces = [];
        this.rawMetrics = [];
        this.rawLogs = [];
    }

    onTrace(trace) {
        this.rawTraces.push(trace);
    }
    onMetrics(trace) {
        this.rawMetrics.push(trace);
    }
    onLogs(trace) {
        this.rawLogs.push(trace);
    }

    /**
     * Return the spans sorted by start time for testing convenience.
     *
     * Note: This may still be unreliable ordering if there are multiple spans
     * started in the same millisecond (e.g. as happens frequently with
     * express middleware spans).
     *
     * TODO: a la TestSpan type from otel-js-contrib
     * @return {Array<object>}
     */
    get sortedSpans() {
        const spans = [];
        this.rawTraces.forEach((rawTrace) => {
            const normTrace = normalizeTrace(rawTrace);
            normTrace.resourceSpans.forEach((resourceSpan) => {
                resourceSpan.scopeSpans.forEach((scopeSpan) => {
                    scopeSpan.spans.forEach((span) => {
                        span.resource = resourceSpan.resource;
                        span.scope = scopeSpan.scope;
                        spans.push(span);
                    });
                });
            });
        });
        return spans.sort((a, b) => {
            assert(typeof a.startTimeUnixNano === 'string');
            assert(typeof b.startTimeUnixNano === 'string');
            const aStartInt = BigInt(a.startTimeUnixNano);
            const bStartInt = BigInt(b.startTimeUnixNano);
            return aStartInt < bStartInt ? -1 : aStartInt > bStartInt ? 1 : 0;
        });
    }

    get metrics() {
        const metrics = [];

        this.rawMetrics.forEach((rawMetric) => {
            const normMetric = normalizeMetrics(rawMetric);
            normMetric.resourceMetrics.forEach((resourceMetric) => {
                resourceMetric.scopeMetrics.forEach((scopeMetric) => {
                    scopeMetric.metrics.forEach((metric) => {
                        metric.resource = resourceMetric.resource;
                        metric.scope = scopeMetric.scope;
                        metrics.push(metric);
                    });
                });
            });
        });

        // TODO: for now we do not need any type of sorting
        // To do so we need to take into account that each metric has a different
        // property depending of the DataPointType (GAUGE, HISTOGRAM, ...) they have
        return metrics;
    }

    get logs() {
        const logs = [];
        this.rawLogs.forEach((logsServiceRequest) => {
            const normLogs = normalizeLogs(logsServiceRequest);
            normLogs.resourceLogs.forEach((resourceLogs) => {
                resourceLogs.scopeLogs.forEach((scopeLogs) => {
                    scopeLogs.logRecords.forEach((logRecord) => {
                        logRecord.resource = resourceLogs.resource;
                        logRecord.scope = scopeLogs.scope;
                        logs.push(logRecord);
                    });
                });
            });
        });

        // TODO: sorting required? Or is incoming order sufficient? s/logs/sortedLogs/ if actively sorting.
        return logs;
    }
}

/**
 * @callback CheckResultCallback
 * @param {import('tape').Test} t
 * @param {import('child_process').ExecFileException | undefined} err
 * @param {string} stdout
 * @param {string} stderr
 */
/**
 * @callback CheckTelemetryCallback
 * @param {import('tape').Test} t
 * @param {CollectorStore} collector
 */

/**
 * Run a series of "test fixture" tests. Each test fixture is an object that
 * defines a Node.js script to run, how to run it (arguments, env, cwd),
 * and function(s) to check the results after it is run. This runner starts
 * a MockOTLPServer for the script to use.
 *
 * Assuming a "fixtures/hello.js" script like this:
 *
 *    const http = require('http');
 *    http.get('http://www.google.com/', (res) => { res.resume(); });
 *
 * a simple example is:
 *
 *    const testFixtures = [
 *      {
 *        args: ['-r', '../start.js', 'fixtures/hello.js'],
 *        cwd: __dirname,
 *        verbose: true, // use to get debug output for the script's run
 *        checkTelemetry: (t, tel) => {
 *          const spans = tel.sortedSpans;
 *          t.equal(spans.length, 1)
 *          t.ok(spans[0].name, 'GET')
 *        }
 *      }
 *    ]
 *    test('module fixtures', suite => {
 *      runTestFixtures(suite, testFixtures)
 *      suite.end()
 *    })
 *
 * Each `testFixtures` script will be executed with a configured
 * OTEL_EXPORTER_OTLP_ENDPOINT. By default it asserts that the script exits
 * successfully.
 *
 * See the options below for controlling how the script is run, how to
 * check the script output, whether to run or skip with the current node
 * version, etc.
 *
 * @typedef {Object} TestFixture
 * @property {string} [name] The name of the test.
 * @property {Array<string>} args The args to `node`.
 * @property {string} [cwd] Typically this is `__dirname`, then the `args` can
 *    be relative to the test file.
 * @property {number} [timeout] A timeout number of milliseconds for the process
 *    to execute. Default 10000.
 * @property {number} [maxBuffer] A maxBuffer to use for the exec.
 * @property {NodeJS.ProcessEnv} [env] Any custom envvars, e.g. `{NODE_OPTIONS:...}`.
 * @property {boolean} [verbose] Set to `true` to include `t.comment()`s showing
 *    the command run and its output. This can be helpful to run the script
 *    manually for dev/debugging.
 * @property {import('tape').TestOptions} [testOpts] Additional tape test opts, if any. https://github.com/ljharb/tape#testname-opts-cb
 * @property {Record<string,string>} [versionRanges] A mapping of required version
 *    ranges for either "node" or a given module name. If current versions don't
 *    satisfy, then the test will be skipped. E.g. this is common for ESM tests:
 *        versionRanges: {
 *          node: NODE_VER_RANGE_IITM
 *        }
 * @property {CheckResultCallback} [checkResult] Check the exit and output of the
 *    script: `checkResult(t, err, stdout, stderr)`. If not provided, by
 *    default it will be asserted that the script exited successfully.
 * @property {CheckTelemetryCallback} [checkTelemetry] Check the results received by the mock
 *    OTLP server. `checkTelemetry(t, collector)`. The second arg is a
 *    `TestCollector` object that has some convenience methods to use the
 *    collected data.
 *
 * @param {import('tape').Test} suite
 * @param {Array<TestFixture>} testFixtures
 */
function runTestFixtures(suite, testFixtures) {
    testFixtures.forEach((tf) => {
        const testName = tf.name ?? quoteArgv(tf.args);
        const testOpts = Object.assign({}, tf.testOpts);
        suite.test(testName, testOpts, async (t) => {
            // Handle "tf.versionRanges"-based skips here, because `tape` doesn't
            // print any message for `testOpts.skip`.
            if (tf.versionRanges) {
                for (const name in tf.versionRanges) {
                    const ver =
                        name === 'node'
                            ? process.version
                            : safeGetPackageVersion(name);
                    if (!semver.satisfies(ver, tf.versionRanges[name])) {
                        t.comment(
                            `SKIP ${name} ${ver} is not supported by this fixture (requires: ${tf.versionRanges[name]})`
                        );
                        t.end();
                        return;
                    }
                }
            }

            const collector = new TestCollector();
            const otlpServer = new MockOtlpServer({
                services: ['http'],
                httpHostname: '127.0.0.1', // avoid default 'localhost' because possible IPv6
                httpPort: 0,
                onTrace: collector.onTrace.bind(collector),
                onMetrics: collector.onMetrics.bind(collector),
                onLogs: collector.onLogs.bind(collector),
            });
            await otlpServer.start();

            const cwd = tf.cwd || process.cwd();
            if (tf.verbose) {
                t.comment(
                    `running: (cd "${cwd}" && ${quoteEnv(
                        tf.env
                    )} node ${quoteArgv(tf.args)})`
                );
            }
            const start = Date.now();
            return new Promise((resolve) => {
                execFile(
                    process.execPath,
                    tf.args,
                    {
                        cwd,
                        timeout: tf.timeout || 10000, // guard on hang, 3s is sometimes too short for CI
                        env: Object.assign(
                            {},
                            process.env,
                            {
                                OTEL_EXPORTER_OTLP_ENDPOINT:
                                    otlpServer.httpUrl.href,
                                OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
                            },
                            tf.env
                        ),
                        maxBuffer: tf.maxBuffer,
                    },
                    async function done(err, stdout, stderr) {
                        if (tf.verbose) {
                            t.comment(
                                `elapsed: ${(Date.now() - start) / 1000}s`
                            );
                            if (err) {
                                t.comment(`err:\n|${formatForTComment(err)}`);
                            }
                            if (stdout) {
                                t.comment(
                                    `stdout:\n|${formatForTComment(stdout)}`
                                );
                            } else {
                                t.comment('stdout: <empty>');
                            }
                            if (stderr) {
                                t.comment(
                                    `stderr:\n|${formatForTComment(stderr)}`
                                );
                            } else {
                                t.comment('stderr: <empty>');
                            }
                        }
                        if (tf.checkResult) {
                            await tf.checkResult(t, err, stdout, stderr);
                        } else {
                            t.error(err, `exited successfully: err=${err}`);
                            if (err) {
                                if (!tf.verbose) {
                                    t.comment(
                                        `stdout:\n|${formatForTComment(stdout)}`
                                    );
                                    t.comment(
                                        `stderr:\n|${formatForTComment(stderr)}`
                                    );
                                }
                            }
                        }
                        if (tf.checkTelemetry) {
                            if (!tf.checkResult && err) {
                                t.comment(
                                    'skip checkTelemetry because process errored out'
                                );
                            } else {
                                await tf.checkTelemetry(t, collector);
                            }
                        }
                        await otlpServer.close();
                        t.end();
                        resolve();
                    }
                );
            });
        });
    });
}

module.exports = {
    dottedLookup,
    findObjInArray,
    findObjsInArray,
    formatForTComment,
    safeGetPackageVersion,
    runTestFixtures,
};
