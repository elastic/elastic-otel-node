// Script to keep protobuf definitons in sync with upstream OTel repository
// https://github.com/open-telemetry/opentelemetry-js
//
// The process will checkout the files at the given tag or hash and copy them
// into `packages/mockotlpserver`. It will also generate the TypeScript types
// of all the services defined (logs, metrics, traces)
//
// NOTE: because of an issue in `protobufjs` we need to use relative paths
// in order to generate the types and actually to work with the lib in general.
// Since we do not want to tamper the downloaded assets we will do the
// necessary modifications in a tremp folder to get the type generation working.
// Ref: https://github.com/protobufjs/protobuf.js/issues/1971

const {execSync} = require('child_process');
const {
    existsSync,
    cpSync,
    rmSync,
    readdirSync,
    readFileSync,
    writeFileSync,
    appendFileSync,
} = require('fs');
const {resolve, relative, join, sep} = require('path');
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
const sourcePath = join(checkoutPath, 'opentelemetry');

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
cpSync(sourcePath, targetPath, {recursive: true});

// 3rd - transform imports from absolute to relative on the checkout folder
const protoPaths = findFiles(resolve(sourcePath, 'proto'), /\.proto$/);

protoPaths.forEach((p) => {
    const content = readFileSync(p, {encoding: 'utf-8'}).split('\n');
    content.forEach((line, idx) => {
        const rexp = /^import "/;
        if (rexp.test(line)) {
            const importPath = line.slice(8, -2);
            const absPath = resolve(sourcePath, '..', importPath);
            // TODO: not sure why but I get an extra `..` than must be removed
            const relPath = relative(p, absPath)
                .replace(sep, '/')
                .replace('../', '');

            content[idx] = `import "${relPath}";`;
        }
    });
    writeFileSync(p, content.join('\n'), {encoding: 'utf-8'});
});

// 4th - add extra info into README.md file in the target folder
// se we have info about which versin we are
const readmePath = resolve(targetPath, 'proto', 'collector', 'README.md');

const appendText = `
### NOTE from Elastic Observability
The contents of these \`.proto\` files have been extracted from the repository
${REPO_URL} at the following tag/hash ${HASH_TAG}.

This will be kept in sync wth the version being used in opentelemetry-js repository
https://github.com/open-telemetry/opentelemetry-js.git
`;

appendFileSync(readmePath, appendText, {encoding: 'utf-8'});

// 5th - generate types using protobufjs-cli from the source path
const rootPath = resolve(__dirname, '..');
const binPath = join(rootPath, 'node_modules', '.bin');
const protosPath = resolve(sourcePath, 'proto');
const protos = [
    '/collector/trace/v1/trace_service.proto',
    '/collector/metrics/v1/metrics_service.proto',
    '/collector/logs/v1/logs_service.proto',
].map((it) => {
    return join(protosPath, it);
});

const generateCommand = [
    // genereate static module
    join(binPath, 'pbjs'),
    '-t static-module',
    `-p ${protosPath}`,
    '-w commonjs',
    '--null-defaults',
    ...protos,
    // Pipe
    '|',
    // Then generate types
    join(binPath, 'pbts'),
    `-o ${rootPath}/packages/mockotlpserver/opentelemetry/proto.d.ts`,
    `-`,
].join(' ');

execSync(generateCommand);

// Finally cleanup the temp folder
rmSync(checkoutPath, {recursive: true, force: true});
