const { resolve } = require('path');

const grpc = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');

const prefix = resolve(__dirname, '../opentelemetry/proto');
const pkgsBase = resolve(__dirname, '..');
const traceDefinition = loader.loadSync(
  `${prefix}/collector/trace/v1/trace_service.proto`,
  {
    includeDirs: [pkgsBase]
  }
);
const traceDescriptor = grpc.loadPackageDefinition(traceDefinition);
const traceNamespace = traceDescriptor.opentelemetry.proto.collector.trace.v1;

const client = new traceNamespace.TraceService(
  "localhost:4317", 
  grpc.credentials.createInsecure()
);

client.Export({
  resourceSpans: [
    {
      resource: {
        "attributes": [
          {
              "key": "service.name",
              "value": {
                  "stringValue": "unknown_service:node"
              }
          },
          {
              "key": "telemetry.sdk.language",
              "value": {
                  "stringValue": "nodejs"
              }
          },
          {
              "key": "telemetry.sdk.name",
              "value": {
                  "stringValue": "opentelemetry"
              }
          },
          {
              "key": "telemetry.sdk.version",
              "value": {
                  "stringValue": "1.15.2"
              }
          },
        ],
        "droppedAttributesCount": 0
      }
    }
  ]
}, (err, response) => {
  console.log("From server error", err);
  console.log("From server response", response);
})
