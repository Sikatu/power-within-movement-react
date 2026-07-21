import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'src', 'assets');
const SRC_DIR = path.join(ROOT, 'src');

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

const assets = walk(ASSETS_DIR);
const allSrcFiles = walk(SRC_DIR, /\.(jsx?|tsx?|css)$/);

const fileContents = allSrcFiles.map(f => fs.readFileSync(f, 'utf8'));

console.log('--- Unused Assets Candidates ---');
for (const asset of assets) {
  const basename = path.basename(asset);
  let isReferenced = false;
  
  for (const content of fileContents) {
    if (content.includes(basename)) {
      isReferenced = true;
      break;
    }
  }
  
  if (!isReferenced) {
    console.log(path.relative(ROOT, asset).replace(/\\/g, '/'));
  }
}
