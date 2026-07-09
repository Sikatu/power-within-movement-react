import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import styleAnalysisImage from '../assets/images/style-analysis-wardrobe-guidance.webp'

const processSteps = [
  {
    title: 'Closet Review',
    text: 'We look at what you own, what you reach for, what no longer feels right, and what your wardrobe is quietly communicating.',
  },
  {
    title: 'Style Alignment',
    text: 'Your body shape, proportion, lifestyle, preferences, and personal presence are brought into one clear style direction.',
  },
  {
    title: 'Your Personalized Style Guide',
    text: 'You receive practical guidance for silhouettes, wardrobe structure, styling choices, and more intentional outfit building.',
  },
]

const styleDirections = [
  'Personalized style guidance aligned with lifestyle and personality',
  'Body shape and proportion recommendations',
  'Signature silhouettes and wardrobe structure',
  'Styling guidance for clothing, layers, and accessories',
  'Greater clarity around intentional wardrobe building',
  'A more cohesive and refined personal style direction',
]

function StyleAnalysis() {
  return (
    <main className="style-analysis-page">
      <PageHero
        eyebrow="Style & Body Analysis"
        title="Personal Style Analysis and Wardrobe Guidance"
        text="Refining your personal style with greater confidence, clarity, and intention."
      />

      <section className="section service-detail-section">
        <div className="story-grid">
          <div className="story-image">
            <img loading="lazy" src={styleAnalysisImage} alt="Personal style analysis session with wardrobe and silhouette guidance" />
          </div>

          <div className="story-copy">
            <p className="eyebrow">Style Clarity</p>
            <h2>Style that honors your body, season, and presence.</h2>
            <p className="service-intro-lead">
              A practical direction for proportion, fit, wardrobe choices, and everyday confidence.
            </p>
            <p className="service-intro-note">
              Less forcing. More ease in how you dress and show up.
            </p>
          </div>
        </div>
      </section>

      <section className="section service-process-section">
        <div className="section-header">
          <p className="eyebrow">Our Process</p>
          <h2>Style direction that meets the woman you are now.</h2>
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
        <div className="service-detail-list-grid style-direction-grid">
          <div>
            <p className="eyebrow">Wardrobe Clarity</p>
            <h2>Personal style creates greater confidence in the way you show up.</h2>
            <p>
              For women seeking a more integrated wardrobe experience, the Virtual
              Closet Upgrade provides outfit organization, styling recommendations,
              and wardrobe visibility in one streamlined space.
            </p>
          </div>

          <div className="service-detail-list style-direction-card">
            <h3>Inside Your Personalized Style Direction</h3>
            <ul>
              {styleDirections.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className="style-direction-card-actions service-detail-card-actions">
              <Link to="/contact?interest=style-analysis" className="btn primary">
                Reserve Your Style Direction
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default StyleAnalysis



