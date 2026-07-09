const fs = require('fs')
const path = require('path')

const root = process.cwd()
const u = (...codes) => String.fromCodePoint(...codes)

const allowedExtensions = new Set([
  '.js',
  '.jsx',
  '.css',
  '.html',
  '.json',
  '.xml',
  '.cjs',
])

const skippedDirs = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
])

const targetRoots = [
  'src',
  'public',
  'scripts',
  'index.html',
]

const replacements = [
  [u(0x00E2, 0x20AC, 0x2122), u(0x2019)],
  [u(0x00E2, 0x20AC, 0x0153), u(0x201C)],
  [u(0x00E2, 0x20AC, 0x009D), u(0x201D)],
  [u(0x00E2, 0x20AC, 0x201C), u(0x2013)],
  [u(0x00E2, 0x20AC, 0x201D), u(0x2014)],
  [u(0x00E2, 0x20AC, 0x00A6), u(0x2026)],
  [u(0x00E2, 0x20AC, 0x00A2), u(0x2022)],
  [u(0x00E2, 0x201E, 0x00A2), u(0x2122)],
  [u(0x00E2, 0x2020, 0x0090), u(0x2190)],
  [u(0x00E2, 0x2020), u(0x2190)],
  [u(0x00E2, 0x2039, 0x00AF), u(0x22EF)],
  [u(0x00C2, 0x00A9), u(0x00A9)],
  [u(0x00C2, 0x00AE), u(0x00AE)],
  [u(0x00C2, 0x00A0), ' '],
  [u(0x00C3, 0x00A2, 0x00E2, 0x20AC, 0x017E, 0x00C2, 0x00A2), u(0x2122)],
  [u(0x00C3, 0x00A2, 0x00E2, 0x20AC, 0x2122), u(0x2019)],
  [u(0x00C3, 0x201A), ''],
  [u(0x00C3, 0x201A, 0x00C2), ''],
]

function shouldSkip(fullPath) {
  return fullPath.split(path.sep).some((part) => skippedDirs.has(part))
}

function walk(entryPath, files = []) {
  if (!fs.existsSync(entryPath)) return files

  const stat = fs.statSync(entryPath)

  if (stat.isFile()) {
    if (allowedExtensions.has(path.extname(entryPath))) files.push(entryPath)
    return files
  }

  if (stat.isDirectory()) {
    if (shouldSkip(entryPath)) return files

    for (const item of fs.readdirSync(entryPath)) {
      walk(path.join(entryPath, item), files)
    }
  }

  return files
}

const files = targetRoots.flatMap((entry) => walk(path.join(root, entry)))

let changed = 0

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8')
  const original = text

  text = text.replace(/^\uFEFF/, '')

  for (const [bad, good] of replacements) {
    text = text.split(bad).join(good)
  }

  text = text.split(u(0x00E2, 0x20AC)).join(u(0x201D))

  if (text !== original) {
    fs.writeFileSync(file, text, 'utf8')
    changed += 1
    console.log('Cleaned:', path.relative(root, file))
  }
}

console.log(`Mojibake cleanup complete. Changed ${changed} file(s).`)