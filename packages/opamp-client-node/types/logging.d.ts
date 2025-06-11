export function logserA2S(a2s: any): any;
export function logserS2A(s2a: any): any;
export class NoopLogger {
    trace(): void;
    debug(): void;
    info(): void;
    error(): void;
    warn(): void;
    fatal(): void;
}
