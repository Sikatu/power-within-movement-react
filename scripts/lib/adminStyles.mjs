import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import postcss from 'postcss'

export const ADMIN_STYLE_ENTRY = 'src/pages/admin/AdminFreshUI.entry.css'
export const ADMIN_STYLE_MODULES = [
  'src/pages/admin/AdminFreshUI.css',
  'src/pages/admin/AdminFreshUI.enhancements.css',
]

function readImportedStylesheet(path, visited = new Set()) {
  const absolutePath = resolve(path)
  if (visited.has(absolutePath)) return ''
  visited.add(absolutePath)

  const source = readFileSync(absolutePath, 'utf8').replace(/\r\n?/g, '\n')
  return source.replace(
    /@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g,
    (_statement, importPath) => readImportedStylesheet(resolve(dirname(absolutePath), importPath), visited),
  )
}

export function readAdminStylesheet() {
  return readImportedStylesheet(ADMIN_STYLE_ENTRY)
}

export function readAdminStyleModules() {
  return ADMIN_STYLE_MODULES.map((path) => ({
    path,
    source: readFileSync(path, 'utf8').replace(/\r\n?/g, '\n'),
  }))
}

export function parseAdminStylesheet() {
  return postcss.parse(readAdminStylesheet(), { from: ADMIN_STYLE_ENTRY })
}

export function normalizeCssSelector(selector) {
  return String(selector || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([,>+~])\s*/g, '$1')
    .replace(/\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .trim()
}

export function normalizeCssValue(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),/])\s*/g, '$1')
    .trim()
}

function selectorMatches(candidate, expected, { allowSuffix = false } = {}) {
  const normalizedCandidate = normalizeCssSelector(candidate)
  const normalizedExpected = normalizeCssSelector(expected)
  if (normalizedCandidate === normalizedExpected) return true
  if (!allowSuffix) return false

  return normalizedCandidate.endsWith(` ${normalizedExpected}`)
    || normalizedCandidate.endsWith(`>${normalizedExpected}`)
    || normalizedCandidate.endsWith(`+${normalizedExpected}`)
    || normalizedCandidate.endsWith(`~${normalizedExpected}`)
}

export function findRules(root, selector, options = {}) {
  const matches = []
  root.walkRules((rule) => {
    const selectors = Array.isArray(rule.selectors) ? rule.selectors : [rule.selector]
    if (selectors.some((candidate) => selectorMatches(candidate, selector, options))) {
      matches.push(rule)
    }
  })
  return matches
}

export function hasSelector(root, selector, options = {}) {
  return findRules(root, selector, options).length > 0
}

export function ruleHasDeclarations(root, selector, declarations, options = {}) {
  return findRules(root, selector, options).some((rule) => {
    const actual = new Map()
    rule.walkDecls((declaration) => {
      actual.set(declaration.prop, normalizeCssValue(declaration.value))
    })

    return declarations.every(([property, value]) =>
      actual.get(property) === normalizeCssValue(value),
    )
  })
}
