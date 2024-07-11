This directory includes support files and details showing how to
deploy the `mockotlpserver` to a Kubernetes cluster.

# How to setup mockotlpserver in a local Kubernetes cluster

This shows how to setup [mockotlpserver](../../) as a service running in a
[kind](https://kind.sigs.k8s.io/) Kubernetes cluster (a small k8s cluster
running locally in Docker).

1. Have Docker running. If you are using Docker for Mac, I do **not** have the
   built-in optional k8s cluster from Docker desktop running. I'm not sure if it
   will interfere.
2. Install `kind` (https://kind.sigs.k8s.io/docs/user/quick-start/#installation).
3. Run the following commands:

```sh
# Start a local Docker registry (at localhost:5001, used to hold locally-built
# images that will be used in the Kubernetes cluster) and a Kind cluster
# configured to use it.
./create-kind-cluster-with-registry.sh

# Build and publish the Docker image for mockotlpserver.
docker build -t mockotlpserver ../..
docker tag mockotlpserver localhost:5001/mockotlpserver
docker push localhost:5001/mockotlpserver

# Deploy the mockotlpserver service.
kubectl apply -f ./mockotlpserver-service.yaml
kubectl apply -f ./mockotlpserver-deployment.yaml
```

If that worked then `kubectl get all` should show a "pod/mockotlpserver-*" Pod in
which the server will be running and a "service/mockotlpserver" that defines the
service. For example:

```
% kubectl get all
NAME                                  READY   STATUS    RESTARTS   AGE
pod/mockotlpserver-845f7d8489-q844c   1/1     Running   0          8s

NAME                     TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
service/kubernetes       ClusterIP   10.96.0.1      <none>        443/TCP    27s
service/mockotlpserver   ClusterIP   10.96.20.238   <none>        8200/TCP   8s

NAME                             READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/mockotlpserver   1/1     1            1           8s

NAME                                        DESIRED   CURRENT   READY   AGE
replicaset.apps/mockotlpserver-845f7d8489   1         1         1       8s
```

Other containers running in the same cluster should be able to use the OTLP
server at `http://mockotlpserver:4317` for gRPC or at port 4318 for HTTP.

Remember to [clean up](#clean-up) after you are done.


# Accessing the `mockotlpserver` from the host

To verify the server is running, let's call it from the host -- i.e. from your
laptop/computer. To reach the mockotlpserver endpoint the pod's ports will
need to be forwarded to the host. For development this can be temporarily done
via `kubectl port-forward`.

In one terminal run:

```sh
kubectl port-forward service/mockotlpserver 4317 4318
```

In another terminal, curl the server:

```
% curl -i localhost:4318
HTTP/1.1 400 Bad Request
Date: Tue, 09 Jul 2024 23:55:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":{"code":400,"message":"Invalid or no data received"}}
```

This shows that the server is listening. This isn't a valid OTLP request so
we expect the HTTP 400 error.

If you *require* access to the mockotlpserver from the host more permanently
(i.e. without having to have `kubectl port-forward` running), then you'll need
to look into setting `hostPort` for the Pod (perhaps via a setting on the
Deployment config?).


# Example using the mockotlpserver

Let's run a small app in our Kubernetes cluster that uses the mockotlpserver to
see it working. "example-app-manual/" holds a small Express-based HTTP app
with a single `GET /ping` endpoint. There is a Kubernetes deployment config
to instrument the app with the Elastic Distribution for OpenTelemetry Node.js
(an wrapper around the OpenTelemetry SDK).

```sh
cd example-app-manual

# Build the Docker image.
docker build -t example-app-manual .
docker tag example-app-manual localhost:5001/example-app-manual
docker push localhost:5001/example-app-manual

# Deploy a single instance of this app, instrumented with an OpenTelemetry SDK
# (via 'NODE_OPTIONS') and configured to send data to the mockotlpserver
# (via 'OTEL_EXPORTER_OTLP_ENDPOINT').
kubectl apply -f ./deployment.yaml
```

If this worked, then the logs for the example-app-manual pod will show the
Elastic distribution for OpenTelemetry Node.js (`@elastic/opentelemetry-node`)
has started, and a number of "server /ping" requests (one from "app.js"
itself, the others from the Kubernetes deployment "livenessProbe"):

```sh
% kubectl get pods
NAME                                  READY   STATUS    RESTARTS   AGE
example-app-manual-7b9765b4f9-v5bkk   1/1     Running   0          41s
mockotlpserver-845f7d8489-q844c       1/1     Running   0          71m

% kubectl logs -f deployment.apps/example-app-manual
...

> example-app-manual@1.0.0 start
> node app.js

{"name":"elastic-otel-node","level":30,"preamble":true,"distroVersion":"0.1.3","env":{"os":"linux 6.6.32-linuxkit","arch":"arm64","runtime":"Node.js v18.20.4"},"msg":"start Elastic Distribution for OpenTelemetry Node.js","time":"2024-07-10T00:17:58.129Z"}
...
Listening on { address: '0.0.0.0', family: 'IPv4', port: 3000 }
[2024-07-10T00:18:00.510Z] server /ping
[2024-07-10T00:18:06.920Z] server /ping
[2024-07-10T00:18:16.923Z] server /ping
...
```

As well, the logs from "service/mockotlpserver" will show requests being made from the OpenTelemetry SDK running in the app's process:

```
% kubectl logs -f service/mockotlpserver
...
------ trace e3bce8 (4 spans) ------
       span 700100 "GET /ping" (1.6ms, SPAN_KIND_SERVER, GET http://10.244.0.14:3000/ping -> 200)
  +0ms `- span 1fe07b "middleware - query" (0.1ms, SPAN_KIND_INTERNAL)
  +1ms `- span 0576c8 "middleware - expressInit" (0.1ms, SPAN_KIND_INTERNAL)
  +0ms `- span cb7eac "request handler - /ping" (0.0ms, SPAN_KIND_INTERNAL)
...
------ metrics ------
      http.client.request.duration (histogram, s, 5 attrs): min=0.021940459, max=0.021940459
...
```

Clean up:

```
kubectl delete deployment example-app-manual
```


# Clean up

When you are done.

```
kind delete cluster --name=kind
docker kill kind-registry
```
