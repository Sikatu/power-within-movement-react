import { Link } from 'react-router-dom'
import radianceImage from '../assets/images/radiance.webp'

function RadianceReclaimed() {
  return (
    <main>
      <section className="radiance-private-hero">
        <Link to="/experiences" className="radiance-back-link">← Back to Experiences</Link>
        <div className="section-header">
          <p className="eyebrow">Radiance Reclaimed™</p>
          <h2>A personal, high-touch experience for the woman ready to inhabit the life that fits who she has become.</h2>
          <p>
            This is not about becoming someone new. It is about returning to the woman
            who was always there — more whole, more deliberate, and more willing to
            inhabit her own life without apology.
          </p>

          <div className="hero-actions">
            <Link to="/contact" className="btn primary">Apply for Radiance Reclaimed™</Link>
          </div>
        </div>
      </section>

      <section className="section story-section">
        <div className="story-grid">
          <div className="story-image">
            <img loading="lazy" src={radianceImage} alt="Radiance Reclaimed" />
          </div>

          <div className="story-copy">
            <p className="eyebrow">The Return</p>
            <h2>Radiance is not a beauty concept.</h2>
            <p>
              It is what becomes visible when a woman stops dimming herself to make
              others comfortable. What arrives when she stops pouring from an empty vessel.
            </p>
            <p>
              Radiance Reclaimed™ was designed for the woman who is done with partial
              answers and ready to bring confidence, wellness, personal presence, color,
              style, and identity into one integrated conversation.
            </p>
          </div>
        </div>
      </section>

      <section className="section intro-section">
        <div className="radiance-chapters">
          <article className="radiance-chapter">
            <span>01</span>
            <div>
              <h3>Personal Sessions</h3>
              <p>Six personal, intentionally paced sessions designed to allow real-life integration between conversations.</p>
            </div>
          </article>

          <article className="radiance-chapter">
            <span>02</span>
            <div>
              <h3>Whole-Person Alignment</h3>
              <p>Personal color, style, wellness, confidence, and presence are addressed together — not as separate problems.</p>
            </div>
          </article>

          <article className="radiance-chapter">
            <span>03</span>
            <div>
              <h3>Tailored Support</h3>
              <p>Resources, guidance, and support are shaped around your season, your identity, and what this transition is asking of you.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="section intro-section">
        <div className="section-header">
          <p className="eyebrow">How to Begin</p>
          <h2>Radiance Reclaimed™ is offered by application only.</h2>
          <p>
            If there appears to be alignment, you will be invited into a guided conversation —
            not a sales call, but a genuine exploration of where you are, what you are navigating,
            and whether this experience is the right fit.
          </p>

          <div className="hero-actions">
            <Link to="/contact" className="btn primary">Apply for Radiance Reclaimed™</Link>
            <Link to="/experiences" className="btn secondary">Explore Other Experiences</Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default RadianceReclaimed


