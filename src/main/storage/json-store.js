const fs = require('fs');
const path = require('path');

function ensureDirectory(directory) {
  try {
    fs.mkdirSync(directory, { recursive: true });
  } catch {}
}

function readJson(filePath, defaults) {
  try {
    const contents = fs.readFileSync(filePath, 'utf8');
    return { ...defaults, ...JSON.parse(contents) };
  } catch {
    return { ...defaults };
  }
}

function writeJson(filePath, value) {
  try {
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  } catch (error) {
    console.error('[Storage] Unable to save JSON file:', error.message);
  }
}

module.exports = { ensureDirectory, readJson, writeJson };
