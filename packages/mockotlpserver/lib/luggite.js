/**
 * This file is from https://github.com/trentm/node-luggite
 * Copyright Trent Mick. Licensed under the MIT license.
 *
 * The luggite logging library for node.js. A logging lib that a technical
 * curmudgeon might even use.
 */

var {format, inspect} = require('util');
var assert = require('assert');
var stream = require('stream');

var safeStableStringify = require('safe-stable-stringify');

var EOL = '\n';

//---- Internal support stuff

/**
 * Warn about an internal processing error.
 *
 * @param msg {String} Message with which to warn.
 * @param [dedupKey] {String} Optional. A short string key for this warning to
 *      have its warning only printed once.
 */
function _warn(msg, dedupKey) {
    assert.ok(msg);
    if (dedupKey) {
        if (_warned[dedupKey]) {
            return;
        }
        _warned[dedupKey] = true;
    }
    process.stderr.write(msg + '\n');
}
var _warned = {};

function ConsoleRawStream() {}
ConsoleRawStream.prototype.write = function (rec) {
    if (rec.level < INFO) {
        console.log(rec);
    } else if (rec.level < WARN) {
        console.info(rec);
    } else if (rec.level < ERROR) {
        console.warn(rec);
    } else {
        console.error(rec);
    }
};

//---- Levels

var TRACE = 10;
var DEBUG = 20;
var INFO = 30;
var WARN = 40;
var ERROR = 50;
var FATAL = 60;

var levelFromName = {
    trace: TRACE,
    debug: DEBUG,
    info: INFO,
    warn: WARN,
    error: ERROR,
    fatal: FATAL,
};
var nameFromLevel = {};
Object.keys(levelFromName).forEach(function (name) {
    nameFromLevel[levelFromName[name]] = name;
});

/**
 * Resolve a level number, name (upper or lowercase) to a level number value.
 *
 * @param {string|number} nameOrNum A level name (case-insensitive) or positive
 *      integer level.
 * @api public
 */
function resolveLevel(nameOrNum) {
    var level;
    if (typeof nameOrNum === 'string') {
        level = levelFromName[nameOrNum.toLowerCase()];
        if (!level) {
            throw new Error(format('unknown level name: "%s"', nameOrNum));
        }
    } else if (typeof nameOrNum !== 'number') {
        throw new TypeError(
            format(
                'cannot resolve level: invalid arg (%s):',
                typeof nameOrNum,
                nameOrNum
            )
        );
    } else if (nameOrNum < 0 || Math.floor(nameOrNum) !== nameOrNum) {
        throw new TypeError(
            format('level is not a positive integer: %s', nameOrNum)
        );
    } else {
        level = nameOrNum;
    }
    return level;
}

/**
 * @param {any} obj
 * @returns {boolean}
 */
function isWritable(obj) {
    if (obj instanceof stream.Writable) {
        return true;
    }
    return typeof obj.write === 'function';
}

//---- Logger class

class Logger {
    constructor(opts) {
        opts = opts || {};
        this._level = Infinity;
        this._stringify = safeStableStringify.configure({deterministic: false});
        this._serializers = {err: errSerializer};
        this._haveNonRawStreams = false;
        this._streams = [];
        this._addStream({
            type: 'stream',
            stream: process.stdout,
            level: opts.level,
        });
        // To allow storing raw log records (unrendered), `this._fields` must never
        // be mutated. Create a copy for any changes.
        this._fields = Object.assign({}, opts.fields);
        if (opts.name) {
            this._fields.name = opts.name;
        }
    }

    /**
     * @param {any} s
     * @param {number|string} [defaultLevel]
     */
    _addStream(s, defaultLevel) {
        if (defaultLevel === null || defaultLevel === undefined) {
            defaultLevel = INFO;
        }

        s = Object.assign({}, s);

        // Implicit 'type' from other args.
        if (!s.type) {
            if (s.stream) {
                s.type = 'stream';
            }
        }
        s.raw = s.type === 'raw'; // PERF: Allow for faster check in `_emit`.

        if (s.level !== undefined) {
            s.level = resolveLevel(s.level);
        } else {
            s.level = resolveLevel(defaultLevel);
        }
        if (s.level < this._level) {
            this._level = s.level;
        }

        switch (s.type) {
            case 'stream':
                assert.ok(
                    isWritable(s.stream),
                    '"stream" stream is not writable: ' + inspect(s.stream)
                );
                break;
            case 'raw':
                break;
            default:
                throw new TypeError('unknown stream type "' + s.type + '"');
        }

        this._streams.push(s);
        if (!this._haveNonRawStreams && !s.raw) {
            this._haveNonRawStreams = true;
        }
    }

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
    level(value) {
        if (value === undefined) {
            return this._level;
        }
        var newLevel = resolveLevel(value);
        var len = this._streams.length;
        for (var i = 0; i < len; i++) {
            this._streams[i].level = newLevel;
        }
        this._level = newLevel;
    }

    /**
     * Apply registered serializers to the appropriate keys in the given fields.
     *
     * Pre-condition: This is only called if there is at least one serializer.
     *
     * @param {object} fields The log record fields.
     * @param {object} excludeFields Optional mapping of keys to `true` for
     *    keys to NOT apply a serializer.
     */
    _applySerializers(fields, excludeFields) {
        var self = this;

        // Check each serializer against these (presuming number of serializers
        // is typically less than number of fields).
        Object.keys(this._serializers).forEach(function (name) {
            if (
                fields[name] === undefined ||
                (excludeFields && excludeFields[name])
            ) {
                return;
            }
            try {
                fields[name] = self._serializers[name](fields[name]);
            } catch (err) {
                _warn(
                    format(
                        'luggite: ERROR: Exception thrown from the "%s" ' +
                            'serializer. This should never happen. This is a bug ' +
                            'in that serializer function.\n%s',
                        name,
                        err.stack || err
                    )
                );
                fields[name] = format(
                    '(Error in log "%s" serializer ' +
                        'broke field. See stderr for details.)',
                    name
                );
            }
        });
    }

    /**
     * Emit a log record.
     *
     * @param {object} rec The log record
     */
    _emit(rec) {
        var i;

        var str;
        if (this._haveNonRawStreams) {
            str = this._stringify(rec) + EOL;
        }

        var level = rec.level;
        for (i = 0; i < this._streams.length; i++) {
            var s = this._streams[i];
            if (s.level <= level) {
                s.stream.write(s.raw ? rec : str);
            }
        }
    }
}

/**
 * Build a record object suitable for emitting from the arguments
 * provided to the a log emitter.
 *
 * @param {any} log
 * @param {any} minLevel
 * @param {Array<any>} args
 * @returns {object}
 */
function mkRecord(log, minLevel, args) {
    var excludeFields, fields, msgArgs;
    if (args[0] instanceof Error) {
        // `log.<level>(err, ...)`
        fields = {
            // Use this Logger's err serializer, if defined.
            err:
                log._serializers && log._serializers.err
                    ? log._serializers.err(args[0])
                    : errSerializer(args[0]),
        };
        excludeFields = {err: true};
        if (args.length === 1) {
            msgArgs = [fields.err.message];
        } else {
            msgArgs = args.slice(1);
        }
    } else if (typeof args[0] !== 'object' || Array.isArray(args[0])) {
        // `log.<level>(msg, ...)`
        fields = null;
        msgArgs = args.slice();
    } else if (Buffer.isBuffer(args[0])) {
        // `log.<level>(buf, ...)`
        // Almost certainly an error, show `inspect(buf)`. See bunyan
        // issue #35.
        fields = null;
        msgArgs = args.slice();
        msgArgs[0] = inspect(msgArgs[0]);
    } else {
        // `log.<level>(fields, msg, ...)`
        fields = args[0];
        if (
            fields &&
            args.length === 1 &&
            fields.err &&
            fields.err instanceof Error
        ) {
            msgArgs = [fields.err.message];
        } else {
            msgArgs = args.slice(1);
        }
    }

    // Build up the record object.
    var rec = Object.assign({}, log._fields);
    rec.level = minLevel;
    if (fields) {
        // TODO(perf): Possible to avoid this Object.assign by tweaking serializer API?
        var recFields = Object.assign({}, fields);
        if (log._serializers) {
            log._applySerializers(recFields, excludeFields);
        }
        Object.assign(rec, recFields);
    }
    rec.msg = format.apply(log, msgArgs);
    if (!rec.time) {
        rec.time = new Date();
    }

    return rec;
}

/**
 * Build a log emitter function for level minLevel. I.e. this is the
 * creator of `log.info`, `log.error`, etc.
 *
 * @param {number} minLevel
 * @returns {function(Record<string, any> | string, ...any): void}
 */
function mkLogEmitter(minLevel) {
    return function LOG(...args) {
        var log = this;
        var rec = null;

        if (!this._emit) {
            // See <https://github.com/trentm/node-bunyan/issues/100> for
            // an example of how this can happen.
            var loc = new Error('');
            loc.name = '';
            _warn(
                'usage error: attempt to log with an unbound log method' +
                    loc.stack,
                'unbound'
            );
            return;
        } else if (args.length === 0) {
            // `log.<level>()`
            return this._level <= minLevel;
        }

        if (this._level <= minLevel) {
            rec = mkRecord(log, minLevel, args);
            this._emit(rec);
        }
    };
}

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
 * @params fields {Object} Optional set of additional fields to log.
 * @params msg {String} Log message. This can be followed by additional
 *    arguments that are handled like
 *    [util.format](http://nodejs.org/docs/latest/api/all.html#util.format).
 */
Logger.prototype.trace = mkLogEmitter(TRACE);
Logger.prototype.debug = mkLogEmitter(DEBUG);
Logger.prototype.info = mkLogEmitter(INFO);
Logger.prototype.warn = mkLogEmitter(WARN);
Logger.prototype.error = mkLogEmitter(ERROR);
Logger.prototype.fatal = mkLogEmitter(FATAL);

// ---- Serializers
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
var errSerializer = function (err) {
    if (!err || !err.stack) return err;
    var obj = {
        message: err.message,
        name: err.name,
        stack: err.stack,
        code: err.code,
        signal: err.signal,
    };
    return obj;
};

//---- Exports

/**
 * @param {any} options
 * @returns {Logger}
 */
function createLogger(options) {
    return new Logger(options);
}

module.exports = {
    TRACE: TRACE,
    DEBUG: DEBUG,
    INFO: INFO,
    WARN: WARN,
    ERROR: ERROR,
    FATAL: FATAL,
    resolveLevel: resolveLevel,
    levelFromName: levelFromName,
    nameFromLevel: nameFromLevel,

    createLogger: createLogger,
    Logger, // exported only for types, should not be used directly, use `createLogger`
};

// vim: tabstop=4 shiftwidth=4 expandtab
