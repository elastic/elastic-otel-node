/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The interface for the "services" that mockotlpserver runs.
 */
class Service {
    async start() {}
    /**
     * @return {null | URL}
     */
    get url() {
        return null;
    }
    async close() {}
}

module.exports = {
    Service,
};
