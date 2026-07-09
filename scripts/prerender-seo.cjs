const fs = require('fs')
const path = require('path')

const SITE_URL = 'https://www.kimmittelstadt.com'
const distDir = path.join(process.cwd(), 'dist')
const indexPath = path.join(distDir, 'index.html')

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.html was not found. Run vite build first.')
  process.exit(1)
}

const baseHtml = fs.readFileSync(indexPath, 'utf8')

const routes = [
  {
    path: '/',
    title: 'Power Within Collective | Confidence Coaching, Color Analysis & Personal Style',
    description:
      'Confidence coaching, color analysis, personal style guidance, beauty direction, and whole-person transformation experiences for women ready to reconnect with presence and self-trust.',
    eyebrow: 'Power Within Collective',
    h1: 'Confidence, presence, style, and whole-person transformation.',
    paragraphs: [
      'Power Within Collective helps women reconnect with confidence, personal presence, color direction, style, beauty, wellness, and the life that fits who they are becoming.',
    ],
  },
  {
    path: '/color-analysis',
    title: 'Color Analysis Consultation for Women | Power Within Collective',
    description:
      'A refined color analysis consultation for women seeking clearer clothing, makeup, accessories, hair direction, and a more confident personal presence.',
    eyebrow: 'Color Analysis',
    h1: 'Color Analysis for Confidence, Style, and Presence',
    paragraphs: [
      'A guided color analysis experience for women who want clearer clothing colors, makeup direction, accessories, hair color guidance, and a stronger sense of personal presence.',
    ],
  },
  {
    path: '/style-analysis',
    title: 'Personal Style Analysis & Wardrobe Guidance | Power Within Collective',
    description:
      'Personal style analysis and wardrobe guidance for women seeking body shape clarity, proportion, outfit direction, and style confidence.',
    eyebrow: 'Style & Body Analysis',
    h1: 'Personal Style Analysis and Wardrobe Guidance',
    paragraphs: [
      'Personal style analysis supports wardrobe clarity, proportion, body shape awareness, outfit direction, and confidence in the season of life you are in now.',
    ],
  },
  {
    path: '/blend-cosmetics',
    title: 'Makeup & Beauty Direction Consultation | Power Within Collective',
    description:
      'A personalized makeup and beauty direction consultation designed around undertones, product choices, application, natural confidence, and everyday polish.',
    eyebrow: 'Makeup Lesson & Direction',
    h1: 'Makeup and Beauty Direction for Natural Confidence',
    paragraphs: [
      'A personalized beauty direction experience focused on undertones, product choices, application, natural confidence, and everyday polish.',
    ],
  },
  {
    path: '/radiance-reclaimed',
    title: 'Women’s Confidence & Presence Coaching | Radiance Reclaimed',
    description:
      'A private confidence and presence coaching experience for women ready for whole-person transformation, self-trust, image alignment, and renewed identity.',
    eyebrow: 'Radiance Reclaimed',
    h1: 'Women’s Confidence and Presence Coaching',
    paragraphs: [
      'Radiance Reclaimed is a private, whole-person transformation experience for women ready to rebuild self-trust, image alignment, identity, confidence, and presence.',
    ],
  },
  {
    path: '/experiences',
    title: 'Confidence, Style & Image Experiences | Power Within Collective',
    description:
      'Explore private confidence coaching, personal style guidance, color analysis, beauty direction, Radiance Reclaimed, and whole-person transformation experiences.',
    eyebrow: 'Experiences',
    h1: 'Confidence, style, image, and personal presence experiences.',
    paragraphs: [
      'Explore private experiences designed to support confidence, color, style, beauty, wellness, personal presence, and whole-person transformation.',
    ],
  },
  {
    path: '/appointments',
    title: 'Personal Image, Color & Style Appointments | Power Within Collective',
    description:
      'Book personalized color analysis, style analysis, makeup direction, beauty guidance, and personal presence appointments for women in a new season of life.',
    eyebrow: 'Appointments',
    h1: 'Personal image, color, style, and beauty appointments.',
    paragraphs: [
      'Personalized appointments help women choose the right support for color direction, style guidance, makeup, beauty, confidence, and personal presence.',
    ],
  },
  {
    path: '/resources',
    title: 'Confidence, Style & Self-Reflection Resources | Power Within Collective',
    description:
      'Curated confidence, personal presence, style, wellness, self-reflection, and self-leadership resources for women returning to themselves.',
    eyebrow: 'Resources',
    h1: 'Confidence, style, and self-reflection resources.',
    paragraphs: [
      'Thoughtful guides and resources for women seeking confidence, personal presence, color direction, style guidance, wellness, and self-leadership.',
    ],
  },
  {
    path: '/resources/what-is-color-analysis',
    title: 'What Is Color Analysis? | Power Within Collective',
    description:
      'Learn what color analysis is and how it supports clothing, makeup, accessories, hair direction, personal presence, and confidence.',
    eyebrow: 'Color Analysis Guide',
    h1: 'What Is Color Analysis?',
    type: 'Article',
    paragraphs: [
      'Color analysis is a guided way to understand which colors support your natural features, wardrobe choices, makeup direction, hair direction, accessories, and personal presence.',
      'The goal is not to place a woman into a rigid box. The goal is to help her understand why some colors feel clear, rested, and expressive while others feel heavy or disconnected.',
    ],
  },
  {
    path: '/resources/what-is-personal-style-analysis',
    title: 'What Is Personal Style Analysis? | Power Within Collective',
    description:
      'Learn how personal style analysis supports wardrobe clarity, body shape, proportion, outfit direction, and confidence for women.',
    eyebrow: 'Style Analysis Guide',
    h1: 'What Is Personal Style Analysis?',
    type: 'Article',
    paragraphs: [
      'Personal style analysis helps women understand wardrobe direction, body shape, proportion, outfit balance, and the clothing choices that support confidence.',
      'It is not about forcing the body into fashion rules. It is about learning how to dress with clarity, ease, and alignment.',
    ],
  },
  {
    path: '/resources/fashion-advice-for-women-over-40',
    title: 'Fashion Advice for Women Over 40 | Power Within Collective',
    description:
      'Fashion advice for women over 40 focused on identity, body confidence, wardrobe clarity, color, proportion, and personal presence.',
    eyebrow: 'Style & Confidence',
    h1: 'Fashion Advice for Women Over 40',
    type: 'Article',
    paragraphs: [
      'Fashion advice for women over 40 should honor identity, lifestyle, body changes, confidence, color, wardrobe clarity, and personal presence.',
      'The goal is not to dress younger. The goal is to dress more truthfully for the woman you are now and the woman you are becoming.',
    ],
  },
  {
    path: '/resources/rebuild-confidence-through-personal-style',
    title: 'How to Rebuild Confidence Through Personal Style | Power Within Collective',
    description:
      'Learn how personal style, color, wardrobe direction, and image alignment can help women rebuild confidence and self-trust.',
    eyebrow: 'Confidence & Style',
    h1: 'How to Rebuild Confidence Through Personal Style',
    type: 'Article',
    paragraphs: [
      'Personal style can help rebuild confidence by creating alignment between identity, wardrobe, color, body language, and the way a woman wants to be seen.',
      'Confidence often returns through small acts of alignment: one color, one outfit, one mirror moment, and one choice that feels honest.',
    ],
  },
  {
    path: '/resources/confidence-coaching-for-women',
    title: 'Confidence Coaching for Women | Power Within Collective',
    description:
      'Confidence coaching for women in a new season of life, with support for identity, presence, image alignment, self-trust, and transformation.',
    eyebrow: 'Confidence Coaching',
    h1: 'Confidence Coaching for Women in a New Season of Life',
    type: 'Article',
    paragraphs: [
      'Confidence coaching for women can support identity, presence, self-trust, image alignment, and whole-person transformation during a new season of life.',
      'The goal is not performance. The goal is alignment, clarity, and self-trust.',
    ],
  },
  {
    path: '/professionals',
    title: 'Image Consultant & Beauty Professional Training | Power Within Professional',
    description:
      'Professional education for beauty, image, style, and wellness professionals who want to turn their expertise into a premium transformation-centered client experience.',
    eyebrow: 'Power Within Professional',
    h1: 'Image consultant and beauty professional training.',
    paragraphs: [
      'Power Within Professional supports beauty, image, style, and wellness professionals who want to create premium, transformation-centered client experiences.',
    ],
  },
  {
    path: '/teen-programs',
    title: 'Teen Confidence Programs for Girls | Power Within Collective',
    description:
      'Supportive teen confidence programs for girls and young women building identity, emotional awareness, self-expression, and grounded self-trust.',
    eyebrow: 'Teen Programs',
    h1: 'Teen Confidence Programs for Girls Becoming Themselves',
    paragraphs: [
      'Supportive programs for girls and young women building identity, confidence, emotional awareness, self-expression, and grounded self-trust.',
    ],
  },
  {
    path: '/podcast',
    title: 'Raising Her Confidence Podcast | Teen Confidence & Mother-Daughter Conversations',
    description:
      'A podcast for mothers, mentors, and adults supporting girls through confidence, identity, emotional wellness, self-expression, and presence.',
    eyebrow: 'Raising Her Confidence',
    h1: 'Conversations for confidence, connection, and the girls we are helping grow.',
    paragraphs: [
      'Raising Her Confidence offers thoughtful conversations for mothers, mentors, and adults supporting girls through confidence, identity, emotional wellness, and presence.',
    ],
  },
  {
    path: '/about',
    title: 'About Kim Mittelstadt | Power Within Collective',
    description:
      'Learn about Kim Mittelstadt, founder of Power Within Collective, and the whole-person foundation behind her confidence, style, beauty, and transformation work.',
    eyebrow: 'About',
    h1: 'About Kim Mittelstadt and Power Within Collective.',
    paragraphs: [
      'Learn about Kim Mittelstadt, founder of Power Within Collective, and the foundation behind her confidence, style, beauty, and transformation work.',
    ],
  },
  {
    path: '/contact',
    title: 'Contact Power Within Collective | Private Consultations & Speaking',
    description:
      'Contact Power Within Collective about private consultations, color analysis, personal style guidance, Radiance Reclaimed, professional education, speaking, podcast, or collaboration.',
    eyebrow: 'Contact',
    h1: 'Contact Power Within Collective.',
    paragraphs: [
      'Begin a conversation about private consultations, color analysis, personal style guidance, Radiance Reclaimed, professional education, speaking, podcast, or collaboration.',
    ],
  },
]

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function replaceTag(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement)
  return html
}

function makeCanonical(routePath) {
  return `${SITE_URL}${routePath === '/' ? '/' : routePath}`
}

function makeStaticContent(route) {
  const paragraphHtml = route.paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('\n          ')

  return `<main class="seo-prerender-content" aria-label="${escapeHtml(route.h1)}">
        <section>
          <p class="eyebrow">${escapeHtml(route.eyebrow)}</p>
          <h1>${escapeHtml(route.h1)}</h1>
          ${paragraphHtml}
        </section>
      </main>`
}

function makeJsonLd(route) {
  const canonical = makeCanonical(route.path)

  if (route.type === 'Article') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: route.h1,
      description: route.description,
      url: canonical,
      mainEntityOfPage: canonical,
      publisher: {
        '@type': 'Organization',
        name: 'Power Within Collective',
        url: SITE_URL + '/',
      },
    }
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: route.h1,
    description: route.description,
    url: canonical,
    publisher: {
      '@type': 'Organization',
      name: 'Power Within Collective',
      url: SITE_URL + '/',
    },
  }
}

function renderRoute(route) {
  const canonical = makeCanonical(route.path)
  let html = baseHtml

  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(route.title)}</title>`)
  html = replaceTag(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(route.description)}" />`)
  html = replaceTag(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
  html = replaceTag(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(route.title)}" />`)
  html = replaceTag(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(route.description)}" />`)
  html = replaceTag(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonical}" />`)
  html = replaceTag(html, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`)
  html = replaceTag(html, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`)

  const routeJsonLd = `<script type="application/ld+json" id="route-structured-data">${JSON.stringify(makeJsonLd(route))}</script>`
  html = html.replace('</head>', `    ${routeJsonLd}\n  </head>`)

  const staticContent = makeStaticContent(route)
  html = html.replace('<div id="root"></div>', `<div id="root">\n      ${staticContent}\n    </div>`)

  return html
}

for (const route of routes) {
  const routeHtml = renderRoute(route)

  if (route.path === '/') {
    fs.writeFileSync(indexPath, routeHtml)
    continue
  }

  const routeDir = path.join(distDir, route.path.replace(/^\//, ''))
  fs.mkdirSync(routeDir, { recursive: true })
  fs.writeFileSync(path.join(routeDir, 'index.html'), routeHtml)
}

console.log(`Pre-rendered ${routes.length} SEO route(s).`)
