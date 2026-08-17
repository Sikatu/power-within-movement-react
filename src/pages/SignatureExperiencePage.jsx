import { Link } from 'react-router-dom'
import SignatureExperienceNav from '../components/SignatureExperienceNav.jsx'
import { signatureExperiences } from '../data/signatureExperiences.js'
import './SignatureExperiences.css'

function SignatureExperiencePage({
  experienceKey,
  activePath,
}) {
  const experience = signatureExperiences[experienceKey]

  const contactPath =
    `/contact?interest=${encodeURIComponent(
      experience.contactInterest,
    )}`

  return (
    <main
      id="main-content"
      className={`focused-page focused-page--${experienceKey}`}
    >
      <section className="focused-hero">
        <div className="section-shell focused-hero-grid">
          <div className="focused-hero-copy">
            <p className="eyebrow">
              Private Personal Presence&trade;
            </p>

            <h1>{experience.title}</h1>

            <p className="focused-hero-lead">
              {experience.lead}
            </p>

            <div className="focused-hero-actions">
              <Link
                className="button button-primary"
                to={contactPath}
              >
                {experience.cta}
              </Link>

              <Link
                className="button button-text"
                to="/experiences"
              >
                Back to Personal Presence
                <span aria-hidden="true"> &rarr;</span>
              </Link>
            </div>

            <p className="focused-hero-note">
              Focused one-to-one guidance for a visible question
              in the chapter you are living now.
            </p>
          </div>

          <div className="focused-hero-visual">
            <span aria-hidden="true" />

            <img
              src={experience.image}
              alt={experience.imageAlt}
            />
          </div>
        </div>
      </section>

      <section className="focused-switcher">
        <div className="section-shell focused-switcher-inner">
          <div>
            <p className="eyebrow">Focused Experiences</p>

            <p>
              Color. Style. Beauty. Begin where the question
              feels clearest.
            </p>
          </div>

          <SignatureExperienceNav
            activePath={activePath}
          />
        </div>
      </section>

      <section
        id={experience.anchor}
        className="focused-story section-shell scroll-target"
      >
        <div>
          <p className="eyebrow">
            {experience.storyEyebrow}
          </p>

          <h2>{experience.storyTitle}</h2>
        </div>

        <div className="focused-story-copy">
          <p>{experience.storyLead}</p>

          <blockquote>
            {experience.storyNote}
          </blockquote>
        </div>
      </section>

      <section className="focused-process">
        <div className="section-shell">
          <header className="focused-section-heading">
            <p className="eyebrow">A Thoughtful Process</p>

            <h2>{experience.processTitle}</h2>
          </header>

          <div className="focused-process-grid">
            {experience.steps.map((step) => (
              <article key={step.title}>
                <span>{step.number}</span>

                <h3>{step.title}</h3>

                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="focused-direction section-shell">
        <div className="focused-direction-copy">
          <p className="eyebrow">
            {experience.listEyebrow}
          </p>

          <h2>{experience.listTitle}</h2>

          <p>{experience.listText}</p>

          <Link
            className="button button-primary"
            to={contactPath}
          >
            {experience.cta}
          </Link>
        </div>

        <div className="focused-direction-list">
          <p className="eyebrow">
            {experience.listCardTitle}
          </p>

          <ul>
            {experience.listItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="focused-next">
        <div className="section-shell focused-next-grid">
          <div className="focused-next-explore">
            <p className="eyebrow">Continue Exploring</p>

            <h2>
              One focused question can be the right place
              to begin.
            </h2>

            <p>
              If another visible area feels more immediate,
              move between the focused experiences without
              treating them as separate versions of you.
            </p>

            <SignatureExperienceNav
              activePath={activePath}
            />
          </div>

          <aside className="focused-radiance-note">
            <p className="eyebrow">
              The Deeper Signature Experience
            </p>

            <h3>Radiance Reclaimed&trade;</h3>

            <p>
              If the question reaches beyond one focused area,
              Radiance brings reflection, color, beauty, style,
              self-expression, connection, and practical
              integration into one intimate retreat experience.
            </p>

            <Link to="/radiance-reclaimed">
              Explore Radiance Reclaimed&trade;
              <span aria-hidden="true"> &rarr;</span>
            </Link>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default SignatureExperiencePage
