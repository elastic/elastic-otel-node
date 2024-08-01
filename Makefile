# This is pure a convenience wrapper around calling npm scripts for those
# with `make` in their veins. Though shalt not add complex logic here.

.PHONY: all
all:
	npm ci

.PHONY: lint
lint:
	npm run lint

.PHONY: test
test:
	cd packages/opentelemetry-node \
		&& npm run test-services:start \
		&& npm test \
		&& npm run test-services:stop

