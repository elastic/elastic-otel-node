/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

console.log(
    'OTEL_EXPORTER_OTLP_HEADERS',
    process.env.OTEL_EXPORTER_OTLP_HEADERS
);
console.log(
    'OTEL_EXPORTER_OTLP_TRACES_HEADERS',
    process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS
);
console.log(
    'OTEL_EXPORTER_OTLP_METRICS_HEADERS',
    process.env.OTEL_EXPORTER_OTLP_METRICS_HEADERS
);
console.log(
    'OTEL_EXPORTER_OTLP_LOGS_HEADERS',
    process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS
);
