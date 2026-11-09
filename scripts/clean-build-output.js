const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const generatedPaths = [
  path.join(projectRoot, 'linux-unpacked'),
  path.join(projectRoot, 'builder-effective-config.yaml'),
  path.join(projectRoot, 'builder-debug.yml'),
];

for (const generatedPath of generatedPaths) {
  fs.rmSync(generatedPath, { recursive: true, force: true });
}
