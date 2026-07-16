import { Link } from 'react-router-dom'
import SignatureExperienceNav from '../components/SignatureExperienceNav.jsx'
import privateGuidanceImage from '../assets/images/experiences-private-guidance.webp'
import radianceImage from '../assets/images/radiance.webp'
import { radianceChapters, radianceFitCards } from '../data/signatureExperiences.js'
import './SignatureExperiences.css'

function RadianceReclaimed() {
  return (
    <main id="main-content" className="signature-page radiance-page">
      <section className="signature-family-hero section-shell">
        <p className="eyebrow">Signature Experiences</p>
        <h1>Four doorways. One integrated return.</h1>
        <p>Color, style, makeup, and the whole-person experience — each designed to help the outside finally reflect the woman you have become.</p>
        <SignatureExperienceNav activePath="/radiance-reclaimed" />
      </section>

      <section className="radiance-experience">
        <div className="section-shell">
          <header className="radiance-intro">
            <p className="eyebrow">Radiance Reclaimed™</p>
            <h2>A personal, high-touch experience for the woman ready to inhabit the life that fits who she has become.</h2>
            <p>This is not about becoming someone new. It is about returning to the woman who was always there — more whole, more deliberate, and more willing to inhabit her own life without apology.</p>
            <Link className="button radiance-gold-button" to="/contact?interest=radiance">Apply for Radiance Reclaimed™</Link>
          </header>

          <div className="radiance-story-grid">
            <img src={radianceImage} alt="Radiance Reclaimed" />
            <div>
              <p className="eyebrow">The Return</p>
              <h3>Radiance is not a beauty concept.</h3>
              <p>It is what becomes visible when a woman stops dimming herself to make others comfortable. What arrives when she stops pouring from an empty vessel.</p>
              <p>Radiance Reclaimed™ was designed for the woman who is done with partial answers and ready to bring confidence, wellness, personal presence, color, style, and identity into one integrated conversation.</p>
            </div>
          </div>

          <section className="radiance-fit">
            <header className="radiance-section-heading">
              <p className="eyebrow">Who This Is For</p>
              <h3>This is not for every woman. It is for the one who is ready.</h3>
              <p>Radiance Reclaimed™ is a private, application-only experience for women who sense they are ready for something more integrated than another fix.</p>
            </header>
            <div className="radiance-card-grid">
              {radianceFitCards.map((card) => (
                <article key={card.title}>
                  <span>{card.number}</span>
                  <h4>{card.title}</h4>
                  <p>{card.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="radiance-process">
            <header className="radiance-section-heading">
              <p className="eyebrow">Inside the Experience</p>
              <h3>Six sessions. One integrated process.</h3>
              <p>Radiance Reclaimed™ moves through three intentional phases — personal, whole-person, and forward-facing — so change has room to actually take hold.</p>
            </header>
            <div className="radiance-chapters">
              {radianceChapters.map((chapter) => (
                <article key={chapter.title}>
                  <span>{chapter.number}</span>
                  <div>
                    <h4>{chapter.title}</h4>
                    <p>{chapter.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <blockquote className="radiance-quote">
            <p>“You do not need to become someone new. You need permission to stop abandoning who you already are.”</p>
            <cite>Power Within Collective™</cite>
          </blockquote>

          <div className="radiance-guided-grid">
            <div>
              <p className="eyebrow">A Private, Guided Process</p>
              <h3>Paced for real integration, not rushed transformation.</h3>
              <p>Radiance Reclaimed™ is intentionally spaced so insight has time to become practice, and practice has time to become identity.</p>
              <p>You are guided personally through color, style, wellness, confidence, and presence — not as separate services, but as one integrated return to yourself.</p>
            </div>
            <img src={privateGuidanceImage} alt="Private, guided Radiance Reclaimed session" />
          </div>

          <section className="radiance-begin">
            <p className="eyebrow">How to Begin</p>
            <h3>Radiance Reclaimed™ is offered by application only.</h3>
            <p>If there appears to be alignment, you will be invited into a guided conversation — not a sales call, but a genuine exploration of where you are, what you are navigating, and whether this experience is the right fit.</p>
            <div>
              <Link className="button radiance-gold-button" to="/contact?interest=radiance">Apply for Radiance Reclaimed™</Link>
              <Link className="button radiance-outline-button" to="/experiences">Explore Other Experiences</Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default RadianceReclaimed
