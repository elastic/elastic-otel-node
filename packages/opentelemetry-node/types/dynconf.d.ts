export type DynConfSpanExportersEvent = {
    enabled: boolean;
};
/**
 * We want exporters (SpanExporter, LogRecordExporter, et al) to be
 * dynamically configurable for some central-config settings.
 *
 * A note in the OTel SDK configuration spec suggests this may eventually be
 * supported (https://opentelemetry.io/docs/specs/otel/configuration/sdk/#config-operations):
 *
 * > TODO: Add operation to update SDK components with new configuration for usage with OpAmp
 *
 * As a workaround for now:
 * 1. We automatically *reach into the internal structure* of OTel JS SDK
 *    components to find the exporter instances, and monkey-patch them. This
 *    works (a) for known SDK exporter classes and (b) for now. Yes this is a
 *    maintenance burden.
 * 2. For custom SDK bootstrap code, we export `createDynConf*` utilities that
 *    can be used to wrap particular SDK components for dynamic configuration.
 *
 * To support loose coupling between SDK and dynamically configurable components
 * **diagnostics_channel is used to communicate config changes**. The loose
 * coupling is needed to avoid needing to *register* components with the SDK
 * after the SDK is created.
 */
export function setupDynConfExporters(sdk: any): void;
/**
 * Dynamically configure the SDK's SpanExporters.
 *
 * @param {DynConfSpanExportersEvent} config
 */
export function dynConfSpanExporters(config: DynConfSpanExportersEvent): void;
