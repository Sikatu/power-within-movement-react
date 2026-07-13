import { Link } from 'react-router-dom'
import SignatureExperienceNav from '../components/SignatureExperienceNav.jsx'
import './SignatureExperiences.css'

function SignatureExperiencePage({ experience, activePath }) {
  return (
    <main id="main-content" className="signature-page">
      <section className="signature-family-hero section-shell">
        <p className="eyebrow">Signature Experiences</p>
        <h1>Four doorways. One integrated return.</h1>
        <p>Color, style, makeup, and the whole-person experience — each designed to help the outside finally reflect the woman you have become.</p>
        <SignatureExperienceNav activePath={activePath} />
      </section>

      <section id={experience.anchor} className="signature-service section-shell scroll-target">
        <header className="signature-service-heading">
          <p className="eyebrow">{experience.eyebrow}</p>
          <h2>{experience.title}</h2>
          <p>{experience.lead}</p>
        </header>

        <div className="signature-story-grid">
          <div className="signature-image-frame">
            <span aria-hidden="true" />
            <img src={experience.image} alt={experience.imageAlt} />
          </div>
          <div>
            <p className="eyebrow">{experience.storyEyebrow}</p>
            <h3>{experience.storyTitle}</h3>
            <p>{experience.storyLead}</p>
            <blockquote>{experience.storyNote}</blockquote>
          </div>
        </div>

        <div className="signature-process">
          <header>
            <p className="eyebrow">Our Process</p>
            <h3>{experience.processTitle}</h3>
          </header>
          <div>
            {experience.steps.map((step) => (
              <article key={step.title}>
                <span>{step.number}</span>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="signature-includes-grid">
          <div>
            <p className="eyebrow">{experience.listEyebrow}</p>
            <h3>{experience.listTitle}</h3>
            <p>{experience.listText}</p>
          </div>
          <aside>
            <h3>{experience.listCardTitle}</h3>
            <ul>
              {experience.listItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <Link className="button button-primary" to="/contact">{experience.cta}</Link>
          </aside>
        </div>
      </section>

      <section className="signature-next-step section-shell">
        <p className="eyebrow">Continue Exploring</p>
        <h2>Choose the doorway that feels most aligned with this season.</h2>
        <SignatureExperienceNav activePath={activePath} />
      </section>
    </main>
  )
}

export default SignatureExperiencePage
