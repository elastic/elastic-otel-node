// Script to generate Types from the proto files
// inspired from a similar script in `opentelemetry-js`
const {resolve, join} = require('path');
const {execSync} = require('child_process');

const rootPath = resolve(__dirname, '..');
const binPath = join(rootPath, 'node_modules', '.bin');
const protosPath = 'packages/mockotlpserver/opentelemetry/proto';
const protos = [
    '/common/v1/common.proto',
    '/resource/v1/resource.proto',
    '/trace/v1/trace.proto',
    '/collector/trace/v1/trace_service.proto',
    '/metrics/v1/metrics.proto',
    '/collector/metrics/v1/metrics_service.proto',
    '/logs/v1/logs.proto',
    '/collector/logs/v1/logs_service.proto',
].map((it) => {
    return join(rootPath, protosPath, it);
});

const generateCommand = [
    // 1st genereate static module
    join(binPath, 'pbjs'),
    '-t static-module',
    `-p ${protosPath}`,
    '-w commonjs',
    '--null-defaults',
    ...protos,
    // Pipe
    '|',
    // Then geenerate types
    join(binPath, 'pbts'),
    `-o ${rootPath}/packages/mockotlpserver/opentelemetry/proto.d.ts`,
    `-`,
].join(' ');

execSync(generateCommand);
