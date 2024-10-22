This document contains informal notes to help developers of the Elastic APM
Node.js agent. Developers should feel free to aggressively weed out obsolete
notes. For structured developer and contributing *rules and guidelines*, see
[CONTRIBUTING.md](./CONTRIBUTING.md).


# mockotlpserver OTLP endpoint

For local development, it can be useful to have an OTLP endpoint that is local,
and can show the exact details of data being sent by the OTel SDK. The
[mockotlpserver package](./packages/mockotlpserver/) in this repository
provides a CLI tool for this.

```sh
git clone https://github.com/elastic/elastic-otel-node.git
cd elastic-otel-node/
npm run ci-all
cd packages/mockotlpserver
npm start -- --help  # mockotlpserver CLI options
npm start
```

This starts a service listening on the default OTLP/gRPC and OTLP/HTTP ports.
It will print received OTLP request data. By default it shows a raw print of
the protobuf request, e.g.:

```
ExportTraceServiceRequest {
  resourceSpans: [
    ResourceSpans {
      scopeSpans: [
        ScopeSpans {
          spans: [
            Span {
              attributes: [
                KeyValue { key: 'http.url', value: AnyValue { stringValue: 'http://localhost:3000/' } },
...
              name: 'GET',
              kind: 2,
...
```

and a "summary" compact representation of the request, e.g.:

```
------ trace 802356 (2 spans) ------
       span f06b1a "GET" (15.5ms, SPAN_KIND_CLIENT, GET http://localhost:3000/ -> 200)
  +9ms `- span 226bf7 "GET" (4.2ms, SPAN_KIND_SERVER, GET http://localhost:3000/ -> 200)
```

Try it with:

```sh
cd elastic-otel-node/examples
node -r @elastic/opentelemetry-node simple-http-request.js
```

See [the mockotlpserver README](./packages/mockotlpserver#readme) for more details.


# Logging tips

`OTEL_LOG_LEVEL=verbose` will turn on the most verbose-level logging in the SDK,
including enabling the core OpenTelemetry `diag` logger messages.

This distro's logging is currently in the JSON format used by the
[`luggite`](https://github.com/trentm/node-luggite) library. It be somewhat
pretty-formatted via the [`pino-pretty` tool](https://github.com/pinojs/pino-pretty):

    OTEL_LOG_LEVEL=verbose node myapp.js | pino-pretty

One of the important libs in the SDK is [require-in-the-middle](https://github.com/elastic/require-in-the-middle)
for intercepting `require(...)` statements for monkey-patching. You can get
debug output from it via:

    DEBUG=require-in-the-middle

And don't forget the node core [`NODE_DEBUG` and `NODE_DEBUG_NATIVE`](https://nodejs.org/api/all.html#cli_node_debug_module)
environment variables:

    NODE_DEBUG=*
    NODE_DEBUG_NATIVE=*


# Testing k8s auto-instrumentation with OTel Operator

This section briefly shows how to locally test the EDOT Node.js Docker image
(docker.elastic.co/observability/elastic-otel-node), with the OpenTelemetry
Operator for Kubernetes. The goal is to deploy a Node.js app to a k8s cluster
and have it auto-instrumented without needing to touch the app -- other than
adding a label to its k8s deployment YAML.

```bash
# Create a local k8s cluster (using KinD), if you don't have one to use.
cd packages/mockotlpserver/share/k8s
./create-kind-cluster-with-registry.sh
# Check that is working via:
#     kubectl cluster-info --context kind-kind
#     docker ps

# Install OTel Operator (and its dependency cert-manager).
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.1/cert-manager.yaml
sleep 10 # Installing the operator immediately after has failed for me.
kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml

# Build and deploy a 'mockotlpserver' that we'll use to collect OTel data.
# If you already have an OTLP collection endpoint (e.g. an Elastic cloud
# deployment), you can skip this step.
cd ../../
docker build -t localhost:5001/mockotlpserver .
docker push localhost:5001/mockotlpserver
cd share/k8s
kubectl apply -f ./mockotlpserver-service.yaml
kubectl apply -f ./mockotlpserver-deployment.yaml
# Check that is working via:
#     kubectl logs service/mockotlpserver  # includes "OTLP/HTTP listening ..."
#     kubectl get all

# Build the elastic-otel-node image.
cd ../../../../packages/opentelemetry-node
docker build -t localhost:5001/elastic-otel-node -f ./Dockerfile ../../
docker push localhost:5001/elastic-otel-node

cd ../../examples/otel-operator

# Create an OTel "Instrumentation", a CRD defined by the OTel Operator, that
# will instrument Node.js apps, exporting telemetry to
# `http://mockotlpserver:4318`, where our mock OTLP server from above is
# listening. (If you used a different OTLP endpoint, then you will need to tweak
# "instrumentation.yaml").
kubectl apply -f ./instrumentation.yaml
# TODO: deal with the "Warning: sampler type not set" here.

# Build and deploy a simple Node.js app (an Express-based HTTP server).
docker build -t localhost:5001/myapp .
docker push localhost:5001/myapp
kubectl apply -f ./deployment.yaml
# To redeploy a change in the application, rerun the docker build & push, then:
#     kubectl rollout restart deployment/myapp
#     kubectl logs --since=10s -f deployment/myapp
```

The `deployment.yaml` for the example "myapp" includes a `livenessProbe`, so the
app will be called periodically. This means we expect to see some tracing data
for `GET /ping` calls.

```bash
kubectl logs -f service/mockotlpserver
```

If things are working you will see trace (and metric) data being received by the
OTLP endpoint. For example:

```
------ trace f5a770 (4 spans) ------
       span d0df8d "GET /ping" (2.8ms, SPAN_KIND_SERVER, GET http://10.244.0.10:3000/ping -> 200)
  +1ms `- span 6a85d1 "middleware - query" (0.1ms, SPAN_KIND_INTERNAL)
  +0ms `- span 2bc334 "middleware - expressInit" (0.1ms, SPAN_KIND_INTERNAL)
  +0ms `- span a739b1 "request handler - /ping" (0.0ms, SPAN_KIND_INTERNAL)
```

Clean up, when done playing:

```bash
kind delete cluster --name=kind
docker kill kind-registry
```
