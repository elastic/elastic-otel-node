export var TRACE: number;
export var DEBUG: number;
export var INFO: number;
export var WARN: number;
export var ERROR: number;
export var FATAL: number;
/** @type {Record<string, number>} */
export var levelFromName: Record<string, number>;
/** @type {Record<number, string>} */
export var nameFromLevel: Record<number, string>;
/**
 * Resolve a level number, name (upper or lowercase) to a level number value.
 *
 * @param {string|number} nameOrNum A level name (case-insensitive) or positive
 *      integer level.
 */
export function resolveLevel(nameOrNum: string | number): number;
/**
 * @param {Object} options
 * @param {string} [options.name] Name for the logger
 * @param {number|string} [options.level] Log level to apply to this logger
 * @param {Record<string, any>} [options.fields]
 * @returns {Logger}
 */
export function createLogger(options: {
    name?: string;
    level?: number | string;
    fields?: Record<string, any>;
}): Logger;
export class Logger {
    /**
     * @param {Object} opts
     * @param {string} [opts.name] Name for the logger
     * @param {number|string} [opts.level] Log level to apply to this logger
     * @param {Record<string, any>} [opts.fields]
     */
    constructor(opts: {
        name?: string;
        level?: number | string;
        fields?: Record<string, any>;
    });
    _level: number;
    _stringify: typeof safeStableStringify.stringify;
    _serializers: {
        err: typeof errSerializer;
    };
    _haveNonRawStreams: boolean;
    _streams: any[];
    _fields: Record<string, any>;
    /**
     * @param {Object} s
     * @param {string} [s.type]
     * @param {number|string} [s.level]
     * @param {stream.Writable} [s.stream]
     * @param {number|string} [defaultLevel]
     */
    _addStream(s: {
        type?: string;
        level?: number | string;
        stream?: stream.Writable;
    }, defaultLevel?: number | string): void;
    /**
     * Get/set the level of all streams on this logger.
     *
     * Get Usage:
     *    // Returns the current log level (lowest level of all its streams).
     *    log.level() -> INFO
     *
     * Set Usage:
     *    log.level(INFO)       // set all streams to level INFO
     *    log.level('info')     // can use 'info' et al aliases
     *
     * @param {number|string} [value]
     * @returns {number|undefined}
     */
    level(value?: number | string): number | undefined;
    /**
     * Apply registered serializers to the appropriate keys in the given fields.
     *
     * Pre-condition: This is only called if there is at least one serializer.
     *
     * @param {Record<string, any>} fields The log record fields.
     * @param {Record<string, boolean>} excludeFields Optional mapping of keys to `true` for
     *    keys to NOT apply a serializer.
     */
    _applySerializers(fields: Record<string, any>, excludeFields: Record<string, boolean>): void;
    /**
     * Emit a log record.
     *
     * @param {object} rec The log record
     */
    _emit(rec: object): void;
    /**
     * The functions below log a record at a specific level.
     *
     * Usages:
     *    log.<level>()  -> boolean is-trace-enabled
     *    log.<level>(<Error> err, [<string> msg, ...])
     *    log.<level>(<string> msg, ...)
     *    log.<level>(<object> fields, <string> msg, ...)
     *
     * where <level> is the lowercase version of the log level. E.g.:
     *
     *    log.info()
     *
     * @param {Object} [fields] Record of additional fields to log.
     * @param {string} msg Log message. This can be followed by additional
     *    arguments that are handled like
     *    [util.format](http://nodejs.org/docs/latest/api/all.html#util.format).
     */
    trace: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
    debug: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
    info: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
    warn: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
    error: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
    fatal: (arg0: string | Record<string, any>, ...arg1: any[]) => void;
}
import safeStableStringify = require("safe-stable-stringify");
/**
 * A serializer is a function that serializes a JavaScript object to a
 * JSON representation for logging. There is a standard set of presumed
 * interesting objects in node.js-land.
 *
 * Serialize an Error object
 * (Core error properties are enumerable in node 0.4, not in 0.6).
 * @param {Error | Object} err
 * @returns {Object}
 */
declare function errSerializer(err: Error | any): any;
import stream = require("stream");
export {};
