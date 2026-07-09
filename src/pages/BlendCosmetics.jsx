import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import blendCosmeticsImage from '../assets/images/blend-cosmetics-makeup-direction.webp'

const processSteps = [
  {
    title: 'Color Discovery',
    text: 'We look at your skin, eyes, hair, undertones, contrast, and the beauty choices that feel most natural to you.',
  },
  {
    title: 'Personalized Selection',
    text: 'You receive product and shade direction that works with your natural coloring instead of working against it.',
  },
  {
    title: 'Signature Finish',
    text: 'You learn an application approach that feels polished, effortless, current, and repeatable.',
  },
]

const professionalSupport = [
  'Curated cosmetic selections aligned to the personal color palette',
  'In-studio product access for ongoing use',
  'Training and support for image consultants and beauty professionals',
  'Guidance in developing or offering professional cosmetic lines with confidence and clarity',
]

function BlendCosmetics() {
  return (
    <main className="makeup-direction-page">
      <PageHero
        eyebrow="Makeup Lesson & Direction"
        title="A Personalized Beauty Experience"
        text="Makeup direction designed to feel polished, effortless, and naturally aligned with you."
      />

      <section className="section service-detail-section">
        <div className="story-grid">
          <div className="story-image">
            <img loading="lazy" src={blendCosmeticsImage} alt="Personalized makeup lesson and beauty direction consultation" />
          </div>

          <div className="story-copy">
            <p className="eyebrow">Makeup Clarity</p>
            <h2>Makeup that feels polished, natural, and fully you.</h2>
            <p className="service-intro-lead">
              Simple direction for shades, technique, products, and an everyday routine you can repeat.
            </p>
            <p className="service-intro-note">
              Less overwhelm. More confidence in your face, color, and finish.
            </p>
          </div>
        </div>
      </section>

      <section className="section service-process-section">
        <div className="section-header">
          <p className="eyebrow">Our Process</p>
          <h2>A calmer way to understand beauty and color.</h2>
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
        <div className="service-detail-list-grid makeup-direction-grid">
          <div>
            <p className="eyebrow">For Clients & Professionals</p>
            <h2>Beauty direction with clarity, confidence, and ease.</h2>
            <p>
              Support for women refining their own routine and professionals guiding clients with more confidence and color clarity.
            </p>
          </div>

          <div className="service-detail-list makeup-direction-card">
            <h3>Support May Include</h3>
            <ul>
              {professionalSupport.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className="makeup-direction-card-actions service-detail-card-actions">
              <Link to="/contact?interest=makeup-lesson" className="btn primary">
                Reserve Your Makeup Direction
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default BlendCosmetics





