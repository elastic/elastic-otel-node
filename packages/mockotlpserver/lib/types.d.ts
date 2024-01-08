import type EventEmitter from 'events';

type Long = { low: number; high: number; unsigned: boolean };
type StringValue = { stringValue: string };
type IntValue = { intValue: Long };

export type AttributeValue = StringValue | IntValue;
export interface Attribute {
    key: string;
    value: AttributeValue;
}

export interface Span {
    traceId: Buffer;
    spanId: Buffer;
    parentSpanId?: Buffer;
    name: string;
    kind: number;
    startTimeUnixNano: Long;
    endTimeUnixNano: Long;
    attributes: Attribute[];
    droppedAttributesCount: number;
    events?: any[];
    droppedEventsCount: number;
    links?: any[];
    droppedLinksCount: number;
    status: { code: number };
}

export interface ScopeSpan {
    scope: { name: string; version: string };
    spans: Span[];
}

export interface ResourceSpan {
    resource: {
        attributes: Attribute[];
    },
    scopeSpans: ScopeSpan[];
}

export interface ExportTraceServiceRequest {
    resourceSpans: ResourceSpan[];
}
