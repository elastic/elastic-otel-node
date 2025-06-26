/**
 * Name of the [deployment environment](https://wikipedia.org/wiki/Deployment_environment) (aka deployment tier).
 *
 * @example staging
 * @example production
 *
 * @note `deployment.environment.name` does not affect the uniqueness constraints defined through
 * the `service.namespace`, `service.name` and `service.instance.id` resource attributes.
 * This implies that resources carrying the following attribute combinations **MUST** be
 * considered to be identifying the same service:
 *
 *   - `service.name=frontend`, `deployment.environment.name=production`
 *   - `service.name=frontend`, `deployment.environment.name=staging`.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_DEPLOYMENT_ENVIRONMENT_NAME: "deployment.environment.name";
/**
 * The name of the deployment.
 *
 * @example deploy my app
 * @example deploy-frontend
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_DEPLOYMENT_NAME: "deployment.name";
/**
 * The number of created spans for which the end operation was called
 *
 * @note For spans with `recording=true`: Implementations **MUST** record both `otel.sdk.span.live` and `otel.sdk.span.ended`.
 * For spans with `recording=false`: If implementations decide to record this metric, they **MUST** also record `otel.sdk.span.live`.
 *
 * @experimental This metric is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const METRIC_OTEL_SDK_SPAN_ENDED: "otel.sdk.span.ended";
/**
 * The number of created spans for which the end operation has not been called yet
 *
 * @note For spans with `recording=true`: Implementations **MUST** record both `otel.sdk.span.live` and `otel.sdk.span.ended`.
 * For spans with `recording=false`: If implementations decide to record this metric, they **MUST** also record `otel.sdk.span.ended`.
 *
 * @experimental This metric is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const METRIC_OTEL_SDK_SPAN_LIVE: "otel.sdk.span.live";
/**
 * The result value of the sampler for this span
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_OTEL_SPAN_SAMPLING_RESULT: "otel.span.sampling_result";
/**
 * Enum value "DROP" for attribute {@link ATTR_OTEL_SPAN_SAMPLING_RESULT}.
 */
export const OTEL_SPAN_SAMPLING_RESULT_VALUE_DROP: "DROP";
/**
 * Enum value "RECORD_AND_SAMPLE" for attribute {@link ATTR_OTEL_SPAN_SAMPLING_RESULT}.
 */
export const OTEL_SPAN_SAMPLING_RESULT_VALUE_RECORD_AND_SAMPLE: "RECORD_AND_SAMPLE";
/**
 * Enum value "RECORD_ONLY" for attribute {@link ATTR_OTEL_SPAN_SAMPLING_RESULT}.
 */
export const OTEL_SPAN_SAMPLING_RESULT_VALUE_RECORD_ONLY: "RECORD_ONLY";
