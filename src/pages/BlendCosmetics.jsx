import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import ContactCTA from '../components/ContactCTA'
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
    <main>
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
            <p className="eyebrow">Beauty With Clarity</p>
            <h2>No trends. No guesswork. Just color that enhances what is already beautifully yours.</h2>
            <p>
              At the Power Within Collective Studio, color is taken personally. With
              years of expertise in image and beauty, this experience guides you toward
              cosmetics that harmonize with your natural undertones, skin, eyes, and hair.
            </p>
            <p>
              Every shade should work with you, not against you, so your makeup feels
              polished, natural, current, and repeatable.
            </p>
            <div className="hero-actions">
              <Link to="/contact" className="btn primary">Book Your Makeup Confidence Lesson</Link>
            </div>
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
        <div className="service-detail-list-grid">
          <div>
            <p className="eyebrow">For Clients & Professionals</p>
            <h2>Beauty direction that can support personal use or professional work.</h2>
            <p>
              This experience can support women seeking a personal makeup routine and
              professionals who want to bring more confidence, clarity, and color wisdom
              into their client work.
            </p>
          </div>

          <div className="service-detail-list">
            <h3>Support May Include</h3>
            <ul>
              {professionalSupport.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <ContactCTA />
    </main>
  )
}

export default BlendCosmetics
