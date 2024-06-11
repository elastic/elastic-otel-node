/// <reference types="node" />
/** @type {import('./luggite').Logger} */
export const log: {
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
/**
 * Register the singleton `log` to handle OTel `api.diag.*()` calls.
 */
export function registerOTelDiagLogger(api: any): void;
