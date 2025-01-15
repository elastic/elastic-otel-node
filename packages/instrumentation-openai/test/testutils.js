/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

'use strict';

// A dumping ground for testing utility functions.

const assert = require('assert/strict');
const fs = require('fs');
const { execFile } = require('child_process');
const path = require('path');

const moduleDetailsFromPath = require('module-details-from-path');
const nock = require('nock');
const { OpenAI, AzureOpenAI } = require('openai');
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
 * Assert the given object matches given expectations.
 *
 * The fields in `expected` are compared against the equivalent field in `actual`:
 * - if `expected` is a RegExp, comparison is via Tape's `t.match()`
 * - if `actual` and `expected` are both arrays, a deep comparison is done,
 * - if `actual` and `expected` are both objects, a deep comparison is done,
 * - if `expected` is a function, it is passed the actual value and the
 *   return value is asserted with `t.ok()`
 * - otherwise comparison is via `t.equal()`
 *
 *      assertDeepMatch(t, {foo: 'bar'}, {foo: /^b/});
 *      assertDeepMatch(t, process.versions, {node: /^18/, napi: '9'});
 */
function assertDeepMatch(t, actual, expected, msgPrefix = 'obj') {
  if (expected instanceof RegExp) {
    t.match(actual, expected, msgPrefix);
  } else if (typeof expected === 'function') {
    t.ok(expected(actual), msgPrefix);
  } else if (Array.isArray(actual) && Array.isArray(expected)) {
    t.equal(actual.length, expected.length, msgPrefix + '.length');
    for (let i = 0; i < Math.min(actual.length, expected.length); i++) {
      assertDeepMatch(t, actual[i], expected[i], msgPrefix + `[${i}]`);
    }
  } else if (
    actual != null &&
    typeof actual === 'object' &&
    expected != null &&
    typeof expected === 'object'
  ) {
    for (let k in expected) {
      const a = actual[k];
      const e = expected[k];
      const kPrefix = msgPrefix + (isIdentifier.test(k) ? `.${k}` : `['${k}']`);
      assertDeepMatch(t, a, e, kPrefix);
    }
  } else {
    t.equal(actual, expected, msgPrefix);
  }
}

// isIdentifier based on https://github.com/sindresorhus/identifier-regex
const isIdentifier = /^[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u;

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
    .map(k => {
      // Environment values should be strings, but be defensive.
      const v =
        typeof env[k] === 'string'
          ? env[k]
          : env[k] == null
            ? ''
            : env[k].toString();
      return `${k}=${quoteArg(v)}`;
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
 * @typedef {import('@opentelemetry/api').Span} Span
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
 * TODO: Likewise for this Span type.
 *
 * @typedef {Object} CollectorStore
 * @property {Span[]} sortedSpans
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
    this.rawTraces.forEach(rawTrace => {
      const normTrace = normalizeTrace(rawTrace);
      normTrace.resourceSpans.forEach(resourceSpan => {
        resourceSpan.scopeSpans.forEach(scopeSpan => {
          scopeSpan.spans.forEach(span => {
            span.resource = resourceSpan.resource;
            span.scope = scopeSpan.scope;
            spans.push(span);
          });
        });
      });
    });
    spans.sort((a, b) => {
      assert(typeof a.startTimeUnixNano === 'string');
      assert(typeof b.startTimeUnixNano === 'string');
      let aStartInt = BigInt(a.startTimeUnixNano);
      let bStartInt = BigInt(b.startTimeUnixNano);

      if (aStartInt === bStartInt) {
        // Fast-created spans that start in the same millisecond cannot
        // reliably be sorted, because OTel JS currently doesn't have
        // sub-ms resolution. Attempt to improve the sorting by using
        // `spanId` and `parentSpanId`: a span cannot start before its
        // parent.
        if (a.parentSpanId && a.parentSpanId === b.spanId) {
          aStartInt += 1n;
        } else if (b.parentSpanId && b.parentSpanId === a.spanId) {
          bStartInt += 1n;
        }
      }

      return aStartInt < bStartInt ? -1 : aStartInt > bStartInt ? 1 : 0;
    });

    // NOTE: Ignore spans from the GCP detector for testing. It shouldn't be
    // creating spans, but that should be fixed upstream.
    return spans.filter(s => {
      const attrs = s.attributes;
      const url = attrs && attrs['http.url'];
      // GCP detector does request to a specific path
      return !url || !url.endsWith('/computeMetadata/v1/instance');
    });
  }

  get metrics() {
    const metrics = [];

    this.rawMetrics.forEach(rawMetric => {
      const normMetric = normalizeMetrics(rawMetric);
      normMetric.resourceMetrics.forEach(resourceMetrics => {
        // The `?.` usages are guards against empty array values (e.g. a
        // MetricsServiceRequest with no ScopeMetrics) being normalized
        // to the `.scopeMetrics` attribute not being set. I'm not sure
        // that normalization isn't a bug itself.
        resourceMetrics.scopeMetrics?.forEach(scopeMetrics => {
          scopeMetrics.metrics?.forEach(metric => {
            metric.resource = resourceMetrics.resource;
            metric.scope = scopeMetrics.scope;
            metrics.push(metric);
          });
        });
      });
    });

    return metrics;
  }

  get logs() {
    const logs = [];
    this.rawLogs.forEach(logsServiceRequest => {
      const normLogs = normalizeLogs(logsServiceRequest);
      normLogs.resourceLogs.forEach(resourceLogs => {
        resourceLogs.scopeLogs.forEach(scopeLogs => {
          scopeLogs.logRecords.forEach(logRecord => {
            logRecord.resource = resourceLogs.resource;
            logRecord.scope = scopeLogs.scope;
            logs.push(logRecord);
          });
        });
      });
    });

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
 *        args: ['-r', '@elastic/opentelemetry-node', 'fixtures/hello.js'],
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
 *    to execute. Default is no timeout.
 * @property {number} [maxBuffer] A maxBuffer to use for the exec.
 * @property {NodeJS.ProcessEnv} [env] Any custom envvars, e.g. `{NODE_OPTIONS:...}`.
 * @property {boolean} [verbose] Set to `true` to include `t.comment()`s showing
 *    the command run and its output. This can be helpful to run the script
 *    manually for dev/debugging.
 * @property {boolean} [only] For development, the set of test fixtures run can
 *    be limited by setting `only: true`.
 * @property {import('tape').TestOptions} [testOpts] Additional tape test opts, if any. https://github.com/ljharb/tape#testname-opts-cb
 * @property {Record<string,string|Array<string>>} [versionRanges] A mapping of
 *    required version ranges for either "node" or a given module name. If
 *    current versions don't satisfy, then the test will be skipped. E.g. this
 *    is common for ESM tests:
 *        versionRanges: {
 *          node: NODE_VER_RANGE_IITM
 *        }
 * @property {CheckResultCallback} [checkResult] Check the exit and output of the
 *    script: `checkResult(t, err, stdout, stderr)`. If not provided, by
 *    default it will be asserted that the script exited successfully.
 * @property {CheckTelemetryCallback} [checkTelemetry] Check the results
 *    received by the mock OTLP server. `checkTelemetry(t, collector, stdout,
 *    stderr)`. The second arg is a `TestCollector` object that has some
 *    convenience methods to use the collected data.
 *
 * @param {import('tape').Test} suite
 * @param {Array<TestFixture>} testFixtures
 * @returns {Promise<undefined>}
 */
function runTestFixtures(suite, testFixtures) {
  // Handle fixtures with `only: true`, if any.
  const onlyTestFixtures = testFixtures.filter(tf => Boolean(tf.only));
  if (onlyTestFixtures.length > 0) {
    suite.comment(
      `ONLY: limiting to "only" ${onlyTestFixtures.length} of ${testFixtures.length} testFixtures`
    );
    testFixtures = onlyTestFixtures;
  }

  // Wrap each test suite in a promise so we can await for it
  const suitePromises = testFixtures.map(tf => {
    // eslint-disable-next-line -- named `outerResolve` to differentiate from the one in inner Promise
        return new Promise((outerResolve) => {
      const testName = tf.name ?? quoteArgv(tf.args);
      const testOpts = Object.assign({}, tf.testOpts);
      suite.test(testName, testOpts, async t => {
        // Handle "tf.versionRanges"-based skips here, because `tape` doesn't
        // print any message for `testOpts.skip`.
        if (tf.versionRanges) {
          for (const name in tf.versionRanges) {
            const ver =
              name === 'node' ? process.version : safeGetPackageVersion(name);
            const verRanges = Array.isArray(tf.versionRanges[name])
              ? tf.versionRanges[name]
              : [tf.versionRanges[name]];
            for (let verRange of verRanges) {
              if (!semver.satisfies(ver, verRange)) {
                t.comment(
                  `SKIP ${name} ${ver} is not supported by this fixture (requires: ${verRanges.join(
                    ', '
                  )})`
                );
                t.end();
                outerResolve();
                return;
              }
            }
          }
        }

        const collector = new TestCollector();
        const otlpServer = new MockOtlpServer({
          logLevel: 'warn',
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
            `running: (cd "${cwd}" && ${quoteEnv(tf.env)} node ${quoteArgv(
              tf.args
            )})`
          );
        }
        const start = Date.now();
        return new Promise(resolve => {
          execFile(
            process.execPath,
            tf.args,
            {
              cwd,
              timeout: tf.timeout || undefined,
              killSignal: 'SIGINT',
              env: Object.assign(
                {},
                process.env,
                {
                  OTEL_EXPORTER_OTLP_ENDPOINT: otlpServer.httpUrl.href,
                  OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
                },
                tf.env
              ),
              maxBuffer: tf.maxBuffer,
            },
            async function done(err, stdout, stderr) {
              if (tf.verbose) {
                t.comment(`elapsed: ${(Date.now() - start) / 1000}s`);
                if (err) {
                  t.comment(`err:\n|${formatForTComment(err)}`);
                }
                if (stdout) {
                  t.comment(`stdout:\n|${formatForTComment(stdout)}`);
                } else {
                  t.comment('stdout: <empty>');
                }
                if (stderr) {
                  t.comment(`stderr:\n|${formatForTComment(stderr)}`);
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
                    t.comment(`stdout:\n|${formatForTComment(stdout)}`);
                    t.comment(`stderr:\n|${formatForTComment(stderr)}`);
                  }
                }
              }
              if (tf.checkTelemetry) {
                if (!tf.checkResult && err) {
                  t.comment('skip checkTelemetry because process errored out');
                } else {
                  await tf.checkTelemetry(t, collector, stdout, stderr);
                }
              }
              await otlpServer.close();
              t.end();
              resolve();
              outerResolve();
            }
          );
        });
      });
    });
  });

  return Promise.all(suitePromises);
}

/**
 * Run the given function `fn` with Nock Back.
 * https://github.com/nock/nock#nock-back
 *
 * `nock` is a Node.js package for mocking of the Node.js `http` and `https`
 * modules. Nock "Back" is nock's feature for recording HTTP request/responses
 * to file and then replaying them in subsequent runs. We are using Nock Back to
 * (a) record OpenAI responses for executions of "fixture/*.js" scripts, and
 * (b) to mock HTTP requests with those recorded responses for regular test
 * runs. This allows for (1) testing against real OpenAI responses and
 * (2) stable test runs.
 *
 * @param {Function} fn - The function to run with nock back.
 * @param {string} recordingName - The base name of the file in which to store
 *      the recordings ("test/fixtures/nock-recordings/${recordingName}.json").
 * @param {nockBackMode} - https://github.com/nock/nock#modes
 *      Typically "lockdown" is used for a test run, "update" is used for
 *      (re)generating recordings.
 */
async function runFnWithNockBack(fn, recordingName, nockBackMode) {
  // Remove any data from recorded responses that could have sensitive data
  // and that we don't need for testing.
  const sanitizeRecordedNockScopes = scopes => {
    for (const scope of scopes) {
      for (let i = 0; i < scope.rawHeaders.length; i += 2) {
        if (scope.rawHeaders[i].toLowerCase() === 'set-cookie') {
          scope.rawHeaders.splice(i, 2);
        }
      }
    }
    return scopes;
  };

  assert(recordingName);
  nock.back.setMode(nockBackMode);
  nock.back.fixtures = path.join(__dirname, 'fixtures', 'nock-recordings');
  const { nockDone } = await nock.back(recordingName + '.json', {
    afterRecord: sanitizeRecordedNockScopes,
  });
  try {
    await fn();
  } finally {
    nockDone();
    // This removes nock's monkey-patching of `http` and `https`. This is
    // necessary so that the OTel SDK being run with the script is able
    // to use HTTP to send its telemetry data. This assumes telemetry is
    // only exported after `fn` is done. So far that has been fine,
    // because the fixture scripts are fast.
    // TODO: Is it possible to configure nock to skip intercepting OTEL_EXPORTER_OTLP_ENDPOINT?
    nock.restore();
  }
}

/**
 * Returns an OpenAI client instance, using the AzureOpenAI client
 * class if `AZURE_OPENAI_API_KEY` is defined.
 */
function createOpenAIClient() {
  const clientCtor = process.env.AZURE_OPENAI_API_KEY ? AzureOpenAI : OpenAI;
  return new clientCtor();
}

module.exports = {
  findObjInArray,
  assertDeepMatch,
  formatForTComment,
  safeGetPackageVersion,
  runTestFixtures,
  runFnWithNockBack,
  createOpenAIClient,
};
