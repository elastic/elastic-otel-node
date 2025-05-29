/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const {stringify: uuidStringify} = require('uuid');

// Serialize some commonly logged objects for logging. The default repr is
// too wordy for the log.

function hexFromUint8Array(arr) {
    const chunks = [];
    arr.forEach((i) => {
        chunks.push((i + 0x100).toString(16).slice(1));
    });
    return chunks.join('');
}

function summaryFromTextyUint8Array(arr, n) {
    const decoder = new TextDecoder();
    if (arr.length <= n) {
        return decoder.decode(arr);
    } else {
        return decoder.decode(arr.slice(0, n)) + '...';
    }
}

function logserInstanceUid(instanceUid) {
    if (!instanceUid) {
        return instanceUid;
    }
    return uuidStringify(instanceUid);
}

const SAFE_TEXTY_CONTENT_TYPES = ['application/json', 'text/yaml'];
function logserRemoteConfig(remoteConfig) {
    if (!remoteConfig) {
        return remoteConfig;
    }
    const ser = {...remoteConfig};
    if (ser.configHash) {
        ser.configHash_ = hexFromUint8Array(ser.configHash);
        delete ser.configHash;
    }
    if (ser.config?.configMap) {
        ser.config = {...ser.config};
        const configMap_ = (ser.config.configMap_ = {});
        for (const k of Object.keys(ser.config.configMap)) {
            const f = {...ser.config.configMap[k]};
            if (SAFE_TEXTY_CONTENT_TYPES.includes(f.contentType)) {
                f.body = summaryFromTextyUint8Array(f.body, 80);
            } else {
                f.body = `...${f.body.length} bytes elided...`;
            }
            configMap_[k] = f;
        }
        delete ser.config.configMap;
    }
    return ser;
}

function logserRemoteConfigStatus(remoteConfigStatus) {
    if (!remoteConfigStatus) {
        return remoteConfigStatus;
    }
    const ser = {
        ...remoteConfigStatus,
        lastRemoteConfigHash: hexFromUint8Array(
            remoteConfigStatus.lastRemoteConfigHash
        ),
    };
    return ser;
}

function logserS2A(s2a) {
    if (!s2a) {
        return s2a;
    }
    return {
        ...s2a,
        instanceUid: logserInstanceUid(s2a.instanceUid),
        remoteConfig: logserRemoteConfig(s2a.remoteConfig),
    };
}

function logserA2S(a2s) {
    if (!a2s) {
        return a2s;
    }
    return {
        ...a2s,
        instanceUid: logserInstanceUid(a2s.instanceUid),
        remoteConfigStatus: logserRemoteConfigStatus(a2s.remoteConfigStatus),
    };
}

/**
 * TODO: Type for LF4JS Logger. An idea for a (Node.)JS equivalent to https://www.slf4j.org/
 * My proposal is that it just has the emit-a-record methods that Bunyan and
 * Pino have, with the signature simplified to Pino's (which no longer takes
 * trailing arguments). Luggite should comply with this. OTel DiagLogger does
 * *not* out of the box because (a) `.verbose()` rather than `.trace()` and
 * (b) doesn't accept leading object/err argument. Would need a shim to
 * accept DiagLogger.
 */

class NoopLogger {
    trace() {}
    debug() {}
    info() {}
    error() {}
    warn() {}
    fatal() {}
}

module.exports = {
    logserA2S,
    logserS2A,
    NoopLogger,
};
