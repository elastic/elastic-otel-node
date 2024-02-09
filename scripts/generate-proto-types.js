// Script to generate Types from the proto files
// inspired from a similar script in `opentelemetry-js`
const {execSync} = require('child_process');
const {
    existsSync,
    cpSync,
    rmSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} = require('fs');
const {resolve, join, sep} = require('path');
const {tmpdir} = require('os');

// SCRIPT PARAMS
const REPO_NAME = 'opentelemetry-proto';
const REPO_URL = `https://github.com/open-telemetry/${REPO_NAME}.git`;
const HASH_TAG = 'v0.20.0';

// HELPER FUNCTIONS
/**
 * Like `find` but in node and limited to names
 * @param {string} dir
 * @param {RegExp} regexp
 */
function findFiles(dir, regexp) {
    const dirents = readdirSync(dir, {withFileTypes: true});
    const result = [];
    dirents.forEach((d) => {
        const path = resolve(dir, d.name);
        if (d.isFile() && regexp.test(d.name)) {
            result.push(path);
        } else if (d.isDirectory()) {
            result.push(...findFiles(path, regexp));
        }
    });
    return result;
}

// MAIN LINE

// 1st checkout the repo at the given hash or tag
const tempPath = tmpdir();
const checkoutPath = `${tempPath}/${REPO_NAME}`;

if (existsSync(checkoutPath)) {
    rmSync(checkoutPath, {recursive: true, force: true});
}
execSync(`git clone --depth 1 --branch ${HASH_TAG} ${REPO_URL}`, {
    cwd: tempPath,
});

// 2nd copy files into the right place
const targetPath = resolve(
    __dirname,
    '..',
    'packages',
    'mockotlpserver',
    'opentelemetry'
);
if (existsSync(targetPath)) {
    rmSync(targetPath, {recursive: true, force: true});
}
cpSync(join(checkoutPath, 'opentelemetry'), targetPath, {recursive: true});

// 3rd - transform imports from absolute to relative
// ref: https://github.com/protobufjs/protobuf.js/issues/1971
const protoPaths = findFiles(resolve(targetPath, 'proto'), /\.proto$/);

protoPaths.forEach((p) => {
    const content = readFileSync(p, {encoding: 'utf-8'}).split('\n');
    content.forEach((line, idx) => {
        const rexp = /^import "/;
        if (rexp.test(line)) {
            let importPath = line.slice(8, -2);
            // Simple solution is just only to `cd ..` until we get
            // to the root folder
            const pathParts = p.split(sep);
            let index = pathParts.length - 1;

            while (pathParts[index] !== 'opentelemetry') {
                importPath = '../' + importPath;
                index--;
            }
            content[idx] = `import "${importPath}";`;
        }
    });
    writeFileSync(p, content.join('\n'), {encoding: 'utf-8'});
});

// 4rt - generate types using protobufjs-cli
const rootPath = resolve(__dirname, '..');
const binPath = join(rootPath, 'node_modules', '.bin');
const protosPath = resolve(targetPath, 'proto');
const protos = [
    '/collector/trace/v1/trace_service.proto',
    '/collector/metrics/v1/metrics_service.proto',
    '/collector/logs/v1/logs_service.proto',
].map((it) => {
    return join(protosPath, it);
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
