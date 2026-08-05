import { readFileSync } from 'node:fs'

const briefSource = readFileSync(
  'src/pages/admin/AdminDailyBrief.jsx',
  'utf8',
)

const stylesheetSource = readFileSync(
  'src/pages/admin/AdminFreshUI.css',
  'utf8',
)

const packageSource = readFileSync(
  'package.json',
  'utf8',
)

const failures = []

const greetingTokens = [
  'const explicitName = String(',
  'const emailLocalPart = String(user?.email || \'\')',
  '.split(/[._+-]+/)',
  "emailFirstName.charAt(0).toUpperCase()",
]

for (const token of greetingTokens) {
  if (!briefSource.includes(token)) {
    failures.push(
      `Today greeting safeguard is missing: ${token}`,
    )
  }
}

const sectionOrder = [
  'pwc-brief15-focus',
  'pwc-brief15-sessions',
  'pwc-brief15-start',
  'pwc-brief15-activity',
].map((token) => briefSource.indexOf(token))

if (
  sectionOrder.some((index) => index < 0)
  || sectionOrder.some(
    (index, position) => (
      position > 0 && index <= sectionOrder[position - 1]
    ),
  )
) {
  failures.push(
    'Today panels do not follow focus, sessions, direct actions, and activity reading order.',
  )
}

const styleTokens = [
  'phase-55b2b-today-layout-start',
  '"focus sessions"',
  '"start activity"',
  'grid-area: focus',
  'grid-area: sessions',
  'grid-area: start',
  'grid-area: activity',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  '"focus"\n      "sessions"\n      "start"\n      "activity"',
  'phase-55b2b-today-layout-end',
]

for (const token of styleTokens) {
  if (!stylesheetSource.includes(token)) {
    failures.push(
      `Today visual safeguard is missing: ${token}`,
    )
  }
}

if (
  !packageSource.includes(
    'node scripts/check-admin-phase55b2b-today-visual.mjs',
  )
) {
  failures.push(
    'package.json does not run the Phase 55B.2B visual audit.',
  )
}

if (failures.length) {
  console.error(
    '\nAdmin Phase 55B.2B Today visual audit failed:\n',
  )

  for (const failure of failures) {
    console.error(`- ${failure}`)
  }

  process.exit(1)
}

console.log(
  'Admin Phase 55B.2B Today visual audit passed (clean greeting, balanced desktop grid, logical reading order, two-column direct actions, and responsive single-column flow).',
)
