import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const deps = Object.keys(pkg.dependencies || {});
const devDeps = Object.keys(pkg.devDependencies || {});

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

const allFiles = walk(ROOT, /\.(js|jsx|ts|tsx|mjs|cjs|html)$/);
const usedPackages = new Set();

const importRegex = /(?:import|require)\s*\(?\s*['"]([^'"./\\][^'"]*)['"]/g;
const staticImportRegex = /import\s+.*?from\s+['"]([^'"./\\][^'"]*)['"]/g;

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const pkgName = match[1].split('/')[0] + (match[1].startsWith('@') ? '/' + match[1].split('/')[1] : '');
    usedPackages.add(pkgName);
  }
  while ((match = staticImportRegex.exec(content)) !== null) {
    const pkgName = match[1].split('/')[0] + (match[1].startsWith('@') ? '/' + match[1].split('/')[1] : '');
    usedPackages.add(pkgName);
  }
}

console.log('--- Unused Dependencies ---');
for (const dep of deps) {
  if (!usedPackages.has(dep) && !builtinModules.includes(dep)) {
    console.log(dep);
  }
}

console.log('\n--- Unused Dev Dependencies ---');
for (const dep of devDeps) {
  if (!usedPackages.has(dep) && !dep.includes('eslint') && !dep.includes('vite') && !dep.includes('types')) {
    console.log(dep);
  }
}
