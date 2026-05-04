/** @type {import('./luggite').Logger} */
export const log: {
    _level: number;
    _stringify: typeof import("safe-stable-stringify").stringify;
    _serializers: {
        err: (err: Error | any) => any;
    };
    _haveNonRawStreams: boolean;
    _streams: any[];
    _fields: Record<string, any>;
    _addStream(s: {
        type?: string;
        level?: number | string;
        stream?: import("stream").Writable;
    }, defaultLevel?: number | string): void;
    level(value?: number | string): number | undefined;
    _applySerializers(fields: Record<string, any>, excludeFields: Record<string, boolean>): void;
    _emit(rec: object): void;
    trace: (arg0: Record<string, any> | string, ...arg1: any[]) => void;
    debug: (arg0: Record<string, any> | string, ...arg1: any[]) => void;
    info: (arg0: Record<string, any> | string, ...arg1: any[]) => void;
    warn: (arg0: Record<string, any> | string, ...arg1: any[]) => void;
    error: (arg0: Record<string, any> | string, ...arg1: any[]) => void;
    fatal: (arg0: Record<string, any> | string, ...arg1: any[]) => void;
};
/**
 * Register the singleton `log` to handle OTel `api.diag.*()` calls.
 */
export function registerOTelDiagLogger(api: any): void;
export const DEFAULT_LOG_LEVEL: string;
