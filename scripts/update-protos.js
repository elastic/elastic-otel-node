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
            const importPath = line.slice(8, -2);
            const absImport = resolve(targetPath, '..', importPath);
            console.log('from', p);
            console.log('to', absImport);
            const relImport = relative(p, absImport).replace(sep, '/');

            content[idx] = `import "${relImport}";`;
        }
    });
    writeFileSync(p, content.join('\n'), {encoding: 'utf-8'});
});

// protoPaths.forEach((p) => {
//     const content = readFileSync(p, {encoding: 'utf-8'}).split('\n');
//     content.forEach((line, idx) => {
//         const rexp = /^import "/;
//         if (rexp.test(line)) {
//             let importPath = line.slice(8, -2);
//             // Simplest solution is just only to `cd ..` until we get
//             // the parent folder of the protos root (opentelemetry)
//             // so the import
//             //    import "opentelemetry/proto/logs/v1/logs.proto";
//             // from ther file
//             //    opentelemetry/proto/collector/logs/v1/logs_service.proto
//             // becomes
//             //    import "../../../../../opentelemetry/proto/logs/v1/logs.proto";
//             const pathParts = p.split(sep);
//             let index = pathParts.length - 1;

//             while (pathParts[index] !== 'opentelemetry') {
//                 importPath = '../' + importPath;
//                 index--;
//             }
//             content[idx] = `import "${importPath}";`;
//         }
//     });
//     writeFileSync(p, content.join('\n'), {encoding: 'utf-8'});
// });

// 4th - add extra info into README.md file
const readmePath = resolve(targetPath, 'proto', 'collector', 'README.md');

const appendText = `
### NOTE from Elastic Observability
The contents of these \`.proto\` files have been extracted from the repository
${REPO_URL} at the following tag/hash ${HASH_TAG}.

This will be kept in sync wth the version being used in opentelemetry-js repository
https://github.com/open-telemetry/opentelemetry-js.git

The import paths of such files have been modified to be relative to avoid issues
when loading them with \`protobufjs\` library. Once the library issue is resolved
the files will be extracted "as is" from the repository.

Ref: https://github.com/protobufjs/protobuf.js/issues/1971
`;

appendFileSync(readmePath, appendText, {encoding: 'utf-8'});

// 5th - generate types using protobufjs-cli
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
