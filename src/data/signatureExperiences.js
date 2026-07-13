import makeupImage from '../assets/images/blend-cosmetics-makeup-direction.webp'
import colorImage from '../assets/images/color-analysis-swatches-session.webp'
import styleImage from '../assets/images/style-analysis-wardrobe-guidance.webp'

export const experienceNavigation = [
  { label: 'Color Analysis', to: '/color-analysis' },
  { label: 'Style & Body Analysis', to: '/style-analysis' },
  { label: 'Makeup Lesson & Direction', to: '/blend-cosmetics' },
  { label: 'Radiance Reclaimed™', to: '/radiance-reclaimed', featured: true },
]

export const signatureExperiences = {
  color: {
    anchor: 'color-analysis',
    eyebrow: 'Color Analysis',
    title: 'Color Analysis for Confidence, Style, and Presence',
    lead: 'Discover the colors that naturally align with your features, presence, and personal style.',
    image: colorImage,
    imageAlt: 'Personal color analysis session with refined swatches and palette guidance',
    storyEyebrow: 'Color Clarity',
    storyTitle: 'Color that feels clear, refined, and fully you.',
    storyLead: 'A personalized palette that brings clear direction to your wardrobe, makeup, accessories, and everyday styling.',
    storyNote: 'So every choice feels easier, more cohesive, and naturally aligned with you.',
    processTitle: 'A thoughtful process for color that feels personal.',
    steps: [
      { number: '01', title: 'Personal Review', text: 'We begin with your natural features, lifestyle, current wardrobe, beauty habits, and the colors you are already drawn toward.' },
      { number: '02', title: 'Color Research', text: 'Your coloring, undertones, contrast, neutrals, and accent shades are studied so the direction feels personal, not generic.' },
      { number: '03', title: 'Your Personalized Guide', text: 'You leave with clear color direction that supports clothing, makeup, accessories, hair direction, and personal presence.' },
    ],
    listEyebrow: 'Color & Presence',
    listTitle: 'The right colors change the way you show up.',
    listText: 'Your personalized color direction becomes a practical reference for shopping, styling, beauty choices, and building a more intentional wardrobe.',
    listCardTitle: 'Inside Your Personalized Color Direction',
    listItems: [
      'Signature colors aligned with your natural features',
      'Foundational neutrals for intentional wardrobe building',
      'Refined accent colors for makeup and accessories',
      'Personalized guidance for clothing, beauty, and personal style',
      'A cohesive palette designed to support confidence and presence',
    ],
    cta: 'Reserve Your Color Direction',
  },
  style: {
    anchor: 'style-analysis',
    eyebrow: 'Style & Body Analysis',
    title: 'Personal Style Analysis and Wardrobe Guidance',
    lead: 'Refining your personal style with greater confidence, clarity, and intention.',
    image: styleImage,
    imageAlt: 'Personal style analysis session with wardrobe and silhouette guidance',
    storyEyebrow: 'Style Clarity',
    storyTitle: 'Style that honors your body, season, and presence.',
    storyLead: 'A practical direction for proportion, fit, wardrobe choices, and everyday confidence.',
    storyNote: 'Less forcing. More ease in how you dress and show up.',
    processTitle: 'Style direction that meets the woman you are now.',
    steps: [
      { number: '01', title: 'Closet Review', text: 'We look at what you own, what you reach for, what no longer feels right, and what your wardrobe is quietly communicating.' },
      { number: '02', title: 'Style Alignment', text: 'Your body shape, proportion, lifestyle, preferences, and personal presence are brought into one clear style direction.' },
      { number: '03', title: 'Your Personalized Style Guide', text: 'You receive practical guidance for silhouettes, wardrobe structure, styling choices, and more intentional outfit building.' },
    ],
    listEyebrow: 'Wardrobe Clarity',
    listTitle: 'Personal style creates greater confidence in the way you show up.',
    listText: 'For women seeking a more integrated wardrobe experience, the Virtual Closet Upgrade provides outfit organization, styling recommendations, and wardrobe visibility in one streamlined space.',
    listCardTitle: 'Inside Your Personalized Style Direction',
    listItems: [
      'Personalized style guidance aligned with lifestyle and personality',
      'Body shape and proportion recommendations',
      'Signature silhouettes and wardrobe structure',
      'Styling guidance for clothing, layers, and accessories',
      'Greater clarity around intentional wardrobe building',
      'A more cohesive and refined personal style direction',
    ],
    cta: 'Reserve Your Style Direction',
  },
  makeup: {
    anchor: 'makeup-direction',
    eyebrow: 'Makeup Lesson & Direction',
    title: 'Makeup and Beauty Direction for Natural Confidence',
    lead: 'Makeup direction designed to feel polished, effortless, and naturally aligned with you.',
    image: makeupImage,
    imageAlt: 'Personalized makeup lesson and beauty direction consultation',
    storyEyebrow: 'Makeup Clarity',
    storyTitle: 'Makeup that feels polished, natural, and fully you.',
    storyLead: 'Simple direction for shades, technique, products, and an everyday routine you can repeat.',
    storyNote: 'Less overwhelm. More confidence in your face, color, and finish.',
    processTitle: 'A calmer way to understand beauty and color.',
    steps: [
      { number: '01', title: 'Color Discovery', text: 'We look at your skin, eyes, hair, undertones, contrast, and the beauty choices that feel most natural to you.' },
      { number: '02', title: 'Personalized Selection', text: 'You receive product and shade direction that works with your natural coloring instead of working against it.' },
      { number: '03', title: 'Signature Finish', text: 'You learn an application approach that feels polished, effortless, current, and repeatable.' },
    ],
    listEyebrow: 'For Clients & Professionals',
    listTitle: 'Beauty direction with clarity, confidence, and ease.',
    listText: 'Support for women refining their own routine and professionals guiding clients with more confidence and color clarity.',
    listCardTitle: 'Support May Include',
    listItems: [
      'Curated cosmetic selections aligned to the personal color palette',
      'In-studio product access for ongoing use',
      'Training and support for image consultants and beauty professionals',
      'Guidance in developing or offering professional cosmetic lines with confidence and clarity',
    ],
    cta: 'Reserve Your Makeup Direction',
  },
}

export const radianceFitCards = [
  { number: '01', title: 'The Woman in Transition', text: 'Navigating a divorce, an empty nest, a career change, or a season that no longer matches who she has become.' },
  { number: '02', title: 'The Woman Who Has “Done the Work”', text: 'She has read the books and tried the routines. Real progress has been made, yet something still feels incomplete or disconnected.' },
  { number: '03', title: 'The Woman Ready to Stop Managing and Start Living', text: 'Done performing composure. Ready to actually inhabit her life, not just maintain it from the outside.' },
]

export const radianceChapters = [
  { number: '01', title: 'Personal Sessions', text: 'Six personal, intentionally paced sessions designed to allow real-life integration between conversations.' },
  { number: '02', title: 'Whole-Person Alignment', text: 'Personal color, style, wellness, confidence, and presence are addressed together — not as separate problems.' },
  { number: '03', title: 'Tailored Support', text: 'Resources, guidance, and support are shaped around your season, your identity, and what this transition is asking of you.' },
]
