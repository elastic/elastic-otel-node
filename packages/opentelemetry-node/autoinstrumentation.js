/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// This file is included in the elastic-otel-node Docker image. It is used by
// the OpenTeleemtry Operator for Kubernetes to support auto-instrumentation of
// Node.js applications. The OTel Operator sets the following envvar for
// Node.js apps to setup the OpenTelemetry SDK:
//      --require .../autoinstrumentation.js

require('./require.js');
