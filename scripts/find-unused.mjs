import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, extFilter = null) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(fullPath, extFilter));
    } else {
      if (extFilter && !extFilter.test(entry.name)) continue;
      results.push(fullPath);
    }
  }
  return results;
}

const allSrcFiles = walk(SRC);
const allFileContents = new Map();

for (const file of allSrcFiles) {
  try {
    allFileContents.set(file, fs.readFileSync(file, 'utf8'));
  } catch (e) {
    // Binary file or unreadable
  }
}

// Very basic reference checker:
// A file is considered referenced if its basename (without extension)
// appears in any OTHER file's content.

const unreferenced = [];

for (const file of allSrcFiles) {
  // Entry points
  const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
  if (['src/main.jsx', 'src/App.jsx', 'src/lib/errorReporter.js'].includes(relPath)) {
    continue;
  }

  const basename = path.basename(file, path.extname(file));
  let isReferenced = false;

  for (const [otherFile, content] of allFileContents.entries()) {
    if (file === otherFile) continue;

    if (content.includes(basename)) {
      isReferenced = true;
      break;
    }
  }

  if (!isReferenced) {
    unreferenced.push(relPath);
  }
}

console.log('--- Unreferenced File Candidates (Basename search) ---');
for (const file of unreferenced) {
  console.log(file);
}
