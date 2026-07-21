import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const learningSource = read('src/pages/ClientPortalLearning.jsx')
const membershipSource = read('src/pages/ClientPortalMembership.jsx')
const circleSource = read('src/pages/ClientPortalCircle.jsx')
const learningStyles = read('src/pages/ClientPortalLearningMembership.css')
const circleStyles = read('src/pages/ClientPortalCircle.css')
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [learningSource, '<p className="eyebrow">Continue Learning</p>', 'current-learning focus'],
  [learningSource, '<details className="learning-program-picker">', 'progressive program chooser'],
  [learningSource, 'aria-label="Learning programs"', 'accessible program list'],
  [learningSource, 'id="current-learning-lesson"', 'direct lesson continuation target'],
  [membershipSource, "const [activeMembershipId, setActiveMembershipId] = useState('')", 'single-membership focus state'],
  [membershipSource, 'aria-label="Your memberships"', 'accessible membership switcher'],
  [membershipSource, 'className="membership-section membership-disclosure"', 'progressive membership benefits'],
  [membershipSource, 'membership-disclosure-body membership-resource-grid', 'progressive member resources'],
  [membershipSource, 'Open Learning Library', 'direct member-learning path'],
  [circleSource, 'circle-layout circle-focused-layout', 'focused Circle feed'],
  [circleSource, '<details className="circle-context-disclosure">', 'progressive Circle context'],
  [circleSource, 'Guidelines &amp; access', 'clear Circle disclosure label'],
  [circleSource, 'This week · {featuredPost.title', 'guided reflection context'],
  [learningStyles, 'phase-42-learning-membership-streamlining-start', 'Learning and Membership responsive styles'],
  [circleStyles, 'phase-42-circle-streamlining-start', 'Circle responsive styles'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const preservedCapabilities = [
  [learningSource, 'getClientLearningLibrary()', 'private Learning Library loading'],
  [learningSource, 'updateClientLearningProgress(lesson.id', 'lesson view and progress tracking'],
  [learningSource, 'notes[activeLesson.id]', 'private lesson notes'],
  [learningSource, 'Mark Lesson Complete', 'lesson completion'],
  [learningSource, "['http:', 'https:'].includes(url.protocol)", 'safe lesson resources'],
  [membershipSource, 'getClientMemberships()', 'private membership loading'],
  [membershipSource, 'membership.started_at', 'membership start dates'],
  [membershipSource, 'membership.renewal_at', 'renewal dates'],
  [membershipSource, 'membership.ends_at', 'access dates'],
  [membershipSource, 'membership.benefits.map', 'all membership benefits'],
  [membershipSource, 'membership.resources.map', 'all member resources'],
  [membershipSource, 'membership.courses.map', 'all included courses'],
  [membershipSource, 'membership.announcements.map', 'all private announcements'],
  [circleSource, 'getClientCircleCommunity()', 'private Circle loading'],
  [circleSource, 'createClientCircleComment(featuredPost.id', 'guided reflection sharing'],
  [circleSource, 'createClientCircleComment(postId', 'Circle replies'],
  [circleSource, 'deleteClientCircleComment(comment.id)', 'own-comment removal'],
  [circleSource, 'setClientCircleReaction(post.id', 'Circle reactions'],
  [circleSource, 'reportClientCircleContent(payload)', 'private moderation reports'],
  [circleSource, 'post.event_starts_at', 'events and challenges'],
  [circleSource, 'logoutClientPortal()', 'secure client sign out'],
]

for (const [source, token, capability] of preservedCapabilities) {
  if (!source.includes(token)) failures.push(`Phase 42 no longer preserves ${capability}`)
}

if (!packageSource.includes('node scripts/check-phase42-client-explore-streamlining.mjs')) {
  failures.push('package.json does not run the Phase 42 Explore audit')
}

if (failures.length) {
  console.error('\nPhase 42 client Explore streamlining audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 42 client Explore streamlining audit passed (focused Learning, one active Membership, calm Circle feed, progressive context, preserved private data and actions, and responsive layouts).',
)
