import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import ContactCTA from '../components/ContactCTA'
import colorAnalysisImage from '../assets/images/color-analysis-swatches-session.webp'

const processSteps = [
  {
    title: 'Personal Review',
    text: 'We begin with your natural features, lifestyle, current wardrobe, beauty habits, and the colors you are already drawn toward.',
  },
  {
    title: 'Color Research',
    text: 'Your coloring, undertones, contrast, neutrals, and accent shades are studied so the direction feels personal, not generic.',
  },
  {
    title: 'Your Personalized Guide',
    text: 'You leave with clear color direction that supports clothing, makeup, accessories, hair direction, and personal presence.',
  },
]

const colorDirections = [
  'Signature colors aligned with your natural features',
  'Foundational neutrals for intentional wardrobe building',
  'Refined accent colors for makeup and accessories',
  'Personalized guidance for clothing, beauty, and personal style',
  'A cohesive palette designed to support confidence and presence',
]

function ColorAnalysis() {
  return (
    <main>
      <PageHero
        eyebrow="Color Analysis"
        title="Personal Color Alignment"
        text="Discover the colors that naturally align with your features, presence, and personal style."
      />

      <section className="section service-detail-section">
        <div className="story-grid">
          <div className="story-image">
            <img loading="lazy" src={colorAnalysisImage} alt="Personal color analysis session with refined swatches and palette guidance" />
          </div>

          <div className="story-copy">
            <p className="eyebrow">Color With Intention</p>
            <h2>Personal Color Alignment creates greater clarity, confidence, and harmony in the way you show up.</h2>
            <p>
              Personal color analysis goes beyond clothing. It helps clarify the colors
              that naturally complement your features, wardrobe, makeup, accessories,
              and overall personal presence.
            </p>
            <p>
              The right colors do not ask you to perform. They support what is already
              present, helping you feel more refined, current, and at home in your own expression.
            </p>
            <div className="hero-actions">
              <Link to="/contact" className="btn primary">Reserve Your Color Experience</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section service-process-section">
        <div className="section-header">
          <p className="eyebrow">Our Process</p>
          <h2>A thoughtful process for color that feels personal.</h2>
        </div>

        <div className="service-process-grid">
          {processSteps.map((step, index) => (
            <article className="service-process-card" key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section service-detail-list-section">
        <div className="service-detail-list-grid">
          <div>
            <p className="eyebrow">Color & Presence</p>
            <h2>The right colors change the way you show up.</h2>
            <p>
              Your personalized color direction becomes a practical reference for
              shopping, styling, beauty choices, and building a more intentional wardrobe.
            </p>
          </div>

          <div className="service-detail-list">
            <h3>Inside Your Personalized Color Direction</h3>
            <ul>
              {colorDirections.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <ContactCTA />
    </main>
  )
}

export default ColorAnalysis
