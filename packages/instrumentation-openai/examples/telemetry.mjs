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

// OpenTelemetry bootstrap code, suitable for use with `--import`, e.g.:
//      node --import ./telemetry.mjs app.js
//
// **Experimental**: This uses the new `createAddHookMessageChannel` functionality
// from import-in-the-middle. `@opentelemetry/instrumentation` needs some work
// to support using that new functionality. As well, if an app has multiple
// import-in-the-middle installations in the `node_modules/...` tree, then things
// are likely to break.

import os from 'os';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { OpenAIInstrumentation } from '../build/src/index.js'; // @elastic/opentelemetry-instrumentation-openai
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

import { register } from 'module';
// TODO: @opentelemetry/instrumentation should re-export this IITM method.
import { createAddHookMessageChannel } from 'import-in-the-middle';

// const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

// Note: If there are *multiple* installations of import-in-the-middle, then
// only those instrumentations using this same one will be hooked.
const { registerOptions, waitForAllMessagesAcknowledged } =
  createAddHookMessageChannel();
// TODO: `@opentelemetry/instrumentation/hook.mjs` needs to re-export initialize
// register('@opentelemetry/instrumentation/hook.mjs', import.meta.url, registerOptions);
register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);

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
  instrumentations: [
    new HttpInstrumentation(),
    new OpenAIInstrumentation({
      captureMessageContent: true,
    }),
  ],
});

process.on('SIGTERM', async () => {
  // Force at least one metrics export, if script run was shorter than metrics interval.
  await metricReader.forceFlush();
  try {
    await sdk.shutdown();
  } catch (err) {
    console.warn('warning: error shutting down OTel SDK', err);
  }
  process.exit(128 + os.constants.signals.SIGTERM);
});

process.once('beforeExit', async () => {
  // Force at least one metrics export, if script run was shorter than metrics interval.
  await metricReader.forceFlush();
  // Flush recent telemetry data if about to shutdown.
  try {
    await sdk.shutdown();
  } catch (err) {
    console.warn('warning: error shutting down OTel SDK', err);
  }
});

sdk.start();

// Ensure that the loader has acknowledged all the modules before we allow
// execution to continue.
await waitForAllMessagesAcknowledged();
