import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  'dist',
  'docs',
  'build',
  'coverage',
  '.cache'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss', '.sass', '.less',
  '.md', '.mdx', '.txt', '.csv', '.yml', '.yaml', '.xml', '.example', '.mjs', '.cjs'
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.zip', '.tar', '.gz'
]);

const ALLOWLIST = [
  // Examples:
  // { file: 'src/data/seed.json', pattern: /Ã/, reason: 'Test data requires corruption' }
];

const FINDINGS = [];

// Detection Patterns
const MOJIBAKE_PATTERNS = [
  { regex: /Ã[©±]/g, desc: 'Likely Latin-1 interpretation of UTF-8 (e.g., Ã© -> é)' },
  { regex: /Â[©\xA0]/g, desc: 'Likely Latin-1 interpretation of UTF-8 (e.g., Â© -> ©, Â  -> NBSP)' },
  { regex: /â€™/g, desc: 'Mojibake for ’ (Right Single Quotation Mark)' },
  { regex: /â€œ/g, desc: 'Mojibake for “ (Left Double Quotation Mark)' },
  { regex: /â€/g, desc: 'Mojibake for ” (Right Double Quotation Mark)' },
  { regex: /â€“/g, desc: 'Mojibake for – (En Dash)' },
  { regex: /â€”/g, desc: 'Mojibake for — (Em Dash)' },
  { regex: /â€¦/g, desc: 'Mojibake for … (Ellipsis)' },
  { regex: /ï»¿/g, desc: 'Mojibake for UTF-8 BOM' },
  { regex: /ðŸ/g, desc: 'Mojibake for Emoji starting with F0 9F' }
];

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
const NULL_BYTE = /\x00/;
const REPLACEMENT_CHAR = /\uFFFD/;
const ZERO_WIDTH_BIDI = /[\u200B\u200C\u200D\u2060\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const BOM = /\uFEFF/g;
const HTML_ENTITIES = /&amp;(nbsp|amp|quot|#39|#x2019);/g;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXCLUDED_EXTENSIONS.has(ext)) continue;

      // If it doesn't have an extension but it's a known text file, or has a text extension
      if (ALLOWED_EXTENSIONS.has(ext) || entry.name.includes('.env') || ext === '') {
        scanFile(fullPath);
      }
    }
  }
}

function checkAllowlist(filePath, match, rule) {
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  for (const entry of ALLOWLIST) {
    if (relPath.includes(entry.file) && entry.pattern.test(match)) {
      return true;
    }
  }
  return false;
}

function addFinding(filePath, lineIndex, match, category, desc, severity) {
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');

  if (checkAllowlist(filePath, match, category)) {
    return;
  }

  FINDINGS.push({
    file: relPath,
    line: lineIndex + 1,
    match,
    category,
    desc,
    severity
  });
}

function scanFile(filePath) {
  const buffer = fs.readFileSync(filePath);

  // 1. Check for UTF-8 validity
  let str = '';
  try {
    str = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (e) {
    FINDINGS.push({
      file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
      line: 0,
      match: 'BINARY/INVALID_UTF8',
      category: 'INVALID_ENCODING',
      desc: 'File contains invalid UTF-8 byte sequences.',
      severity: 'Critical'
    });
    return; // Don't process further if it's not valid UTF-8
  }

  const lines = str.split(/\r?\n/);
  const relativePath = path
    .relative(ROOT, filePath)
    .replace(/\\/g, '/');
  const isScannerSource =
    relativePath === 'scripts/check-encoding.mjs';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Null bytes
    if (NULL_BYTE.test(line)) {
      addFinding(filePath, i, '\\x00', 'NULL_BYTE', 'Null byte detected', 'Critical');
    }

    // Control characters
    const ctrlMatches = line.match(CONTROL_CHARS);
    if (ctrlMatches) {
      for (const m of ctrlMatches) {
        if (m !== '\\x00') {
           addFinding(filePath, i, m, 'CONTROL_CHAR', `Suspicious control character: \\x${m.charCodeAt(0).toString(16)}`, 'High');
        }
      }
    }

    // Replacement characters
    if (REPLACEMENT_CHAR.test(line)) {
      addFinding(filePath, i, '', 'REPLACEMENT_CHAR', 'Unicode replacement character (failed decoding)', 'High');
    }

    // The scanner contains intentional detector signatures.
    if (!isScannerSource) {
      for (const rule of MOJIBAKE_PATTERNS) {
        const ruleMatches = line.match(rule.regex);

        if (ruleMatches) {
          for (const detectedMatch of ruleMatches) {
            addFinding(
              filePath,
              i,
              detectedMatch,
              'MOJIBAKE',
              rule.desc,
              'High'
            );
          }
        }
      }
    }

    // Zero-width & Bidi
    const bidiMatches = line.match(ZERO_WIDTH_BIDI);
    if (bidiMatches) {
      for (const m of bidiMatches) {
        addFinding(filePath, i, m, 'ZERO_WIDTH_BIDI', `Invisible/Bidi char: \\u${m.charCodeAt(0).toString(16).padStart(4, '0')}`, 'Medium');
      }
    }

    // BOM
    if (line.includes('\uFEFF')) {
      if (i === 0 && line.indexOf('\uFEFF') === 0) {
        addFinding(filePath, i, '\\uFEFF', 'BOM', 'File starts with a Byte Order Mark', 'Medium');
        if (line.indexOf('\uFEFF', 1) !== -1) {
           addFinding(filePath, i, '\\uFEFF', 'BOM_INTERNAL', 'Byte Order Mark found inside file content', 'Medium');
        }
      } else {
        addFinding(filePath, i, '\\uFEFF', 'BOM_INTERNAL', 'Byte Order Mark found inside file content', 'Medium');
      }
    }

    // HTML Entities (double encoded or suspicious)
    const entityMatches = line.match(HTML_ENTITIES);
    if (entityMatches) {
      for (const m of entityMatches) {
        addFinding(filePath, i, m, 'DOUBLE_ENCODED_ENTITY', 'Suspicious HTML entity (might be double encoded)', 'Low');
      }
    }
  }
}

console.log('Running Encoding & Character Integrity Scanner...');
walk(ROOT);

console.log(`Scan complete. Found ${FINDINGS.length} issues.\n`);

const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
FINDINGS.forEach(f => {
  severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
});

console.log(JSON.stringify(severityCounts, null, 2));

if (FINDINGS.length > 0) {
  // Sort by file, then line
  FINDINGS.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  console.log('\nFindings Details:');
  for (const f of FINDINGS) {
    const matchStr = f.match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    console.log(`[${f.severity}] ${f.file}:${f.line} - ${f.category}: ${f.desc} (Matched: "${matchStr}")`);
  }
}

// Exit code for CI
if (severityCounts.Critical > 0 || severityCounts.High > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
