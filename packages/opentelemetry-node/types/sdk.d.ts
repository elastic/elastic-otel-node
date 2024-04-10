/// <reference types="node" />
export type NodeSDKConfiguration = import('@opentelemetry/sdk-node').NodeSDKConfiguration;
export class ElasticNodeSDK extends NodeSDK {
    _metricsDisabled: boolean;
    _log: {
        _level: number;
        _stringify: typeof import("safe-stable-stringify").stringify;
        _serializers: {
            err: (err: any) => any;
        };
        _haveNonRawStreams: boolean;
        _streams: any[];
        _fields: Record<string, any>;
        _addStream(s: {
            type?: string;
            level?: string | number;
            stream?: import("stream").Writable;
        }, defaultLevel?: string | number): void;
        level(value?: string | number): number;
        _applySerializers(fields: Record<string, any>, excludeFields: Record<string, boolean>): void;
        _emit(rec: any): void;
        trace: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
        debug: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
        info: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
        warn: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
        error: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
        fatal: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
    };
}
import { NodeSDK } from "@opentelemetry/sdk-node/build/src/sdk";
