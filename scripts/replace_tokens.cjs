const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'src', 'pages', 'admin', 'AdminFreshUI.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

const replacements = {
  '--admin-bg-deep': '--color-bg-deep',
  '--admin-bg': '--color-page',
  '--admin-surface-soft': '--color-surface-soft',
  '--admin-surface-gold': '--color-surface-gold',
  '--admin-surface': '--color-paper',
  '--admin-ink-soft': '--color-ink-soft',
  '--admin-ink': '--color-heading',
  '--admin-body': '--color-body',
  '--admin-muted': '--color-muted',
  '--admin-faint': '--color-faint',
  '--admin-gold-deep': '--color-gold-label',
  '--admin-gold': '--color-gold',
  '--admin-burgundy-deep': '--color-burgundy-dark',
  '--admin-burgundy': '--color-burgundy',
  '--admin-sidebar-deep': '--color-sidebar-deep',
  '--admin-sidebar': '--color-sidebar',
  '--admin-success': '--color-success',
  '--admin-warning': '--color-warning',
  '--admin-danger': '--color-error',
  '--admin-border-strong': '--color-border-strong',
  '--admin-gold-border': '--color-gold-border',
  '--admin-border': '--color-border',
  '--admin-shadow-raised': '--shadow-raised',
  '--admin-shadow-soft': '--shadow-soft',
  '--admin-shadow': '--shadow-soft',
  '--admin-focus': '--focus-ring',
  '--admin-radius-sm': '--radius-sm',
  '--admin-radius-lg': '--radius-lg',
  '--admin-radius': '--radius-md',
  '--admin-content': '--content-admin-max',
};

for (const [oldVar, newVar] of Object.entries(replacements)) {
  const regex = new RegExp(oldVar.replace(/-/g, '\\-'), 'g');
  cssContent = cssContent.replace(regex, newVar);
}

const tokensToRemove = Object.values(replacements);
for (const t of tokensToRemove) {
    if (t.startsWith('var(')) continue;
    const regexInline = new RegExp(`${t}\\:[^;]+;`, 'g');
    cssContent = cssContent.replace(regexInline, '');
}

fs.writeFileSync(cssPath, cssContent);
console.log('AdminFreshUI.css Variable replacement completed.');
