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

// Setup OTel telemetry using the OpenAI instrumentation in this repo.

const os = require('os');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const {
  OTLPMetricExporter,
} = require('@opentelemetry/exporter-metrics-otlp-proto');
const {
  OTLPTraceExporter,
} = require('@opentelemetry/exporter-trace-otlp-proto');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-proto');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { OpenAIInstrumentation } = require('../../'); // @elastic/opentelemetry-instrumentation-openai
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

// const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

// At time of writing, NodeSDK does not automatically provide a LoggerProvider
// so we must manually pass one in. Note that this simple implementation does
// not respond to the OTel specified OTEL_EXPORTER_OTLP_LOGS_PROTOCOL and
// OTEL_EXPORTER_OTLP_PROTOCOL envvars.
const logRecordProcessor = new BatchLogRecordProcessor(new OTLPLogExporter());

const metricReader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter(),
});

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  logRecordProcessor,
  metricReader,
  instrumentations: [new HttpInstrumentation(), new OpenAIInstrumentation()],
});

process.on('SIGTERM', async () => {
  // SDK shutdown does not seem to flush metrics.
  await metricReader.forceFlush();
  try {
    await sdk.shutdown();
  } catch (err) {
    console.warn('warning: error shutting down OTel SDK', err);
  }
  process.exit(128 + os.constants.signals.SIGTERM);
});

process.once('beforeExit', async () => {
  // SDK shutdown does not seem to flush metrics.
  await metricReader.forceFlush();
  // Flush recent telemetry data if about to shutdown.
  try {
    await sdk.shutdown();
  } catch (err) {
    console.warn('warning: error shutting down OTel SDK', err);
  }
});

sdk.start();
