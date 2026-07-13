import { Link } from 'react-router-dom'
import kimImage from '../assets/images/kim.webp'
import corinneImage from '../assets/images/team/corinne.webp'
import danielleImage from '../assets/images/team/danielle.webp'
import kennyImage from '../assets/images/team/kenny.webp'
import './About.css'

const team = [
  {
    number: '01',
    name: 'Corinne McCausland',
    image: corinneImage,
    text: 'Wellness & Lifestyle Coach supporting women through full-life transitions with practical, grounded wellness.',
  },
  {
    number: '02',
    name: 'Danielle Schonhoff',
    image: danielleImage,
    text: 'Photographer and Hair + Makeup Artist creating spaces where women feel like themselves before they see themselves.',
  },
  {
    number: '03',
    name: 'Dr. Kenny Mittelstadt',
    image: kennyImage,
    text: 'Root Cause Functional Medicine Practitioner with a systems-based view of energy, hormones, stress, digestion, and cellular health.',
  },
]

function About() {
  return (
    <main id="main-content" className="about-page">
      <section className="about-hero section-shell">
        <p className="eyebrow">About</p>
        <h1>The foundation behind Power Within Collective™.</h1>
        <p>A whole-person brand built around congruence, self-recognition, and the woman in a new season of life.</p>
      </section>

      <section className="about-founder section-shell">
        <div className="about-founder-image">
          <span aria-hidden="true" />
          <img src={kimImage} alt="Kim Mittelstadt, founder of Power Within Collective" />
        </div>
        <div className="about-founder-copy">
          <p className="eyebrow">Kim Mittelstadt</p>
          <h2>She saw that the right colors were not always enough.</h2>
          <p>For nearly four decades, Kim worked in beauty and image. She watched women receive the right colors, wardrobe guidance, and styling advice, yet still leave feeling disconnected from the woman in the mirror.</p>
          <p>Over time, she recognized a deeper truth: the outside can support a woman&apos;s return, but it cannot complete what the inside has not begun.</p>
          <p>Her work now brings identity, wellness, color, style, and Personal Presence™ into one conversation.</p>
        </div>
      </section>

      <section className="about-wisdom section-shell">
        <p className="eyebrow">Earned Wisdom</p>
        <h2>Her work was shaped by real life, not theory alone.</h2>
        <p>Kim raised six children through military life, relocations, reinventions, and seasons that asked her to become someone new more than once. She learned that belonging is never worth the cost of self-abandonment.</p>
      </section>

      <section className="about-belief section-shell">
        <blockquote>
          <p>“Confidence is not something you fix or force; it is something you reclaim.”</p>
          <cite>Power Within Collective™</cite>
        </blockquote>
      </section>

      <section className="about-team section-shell">
        <header className="about-section-heading">
          <p className="eyebrow">The Collective Team</p>
          <h2>Different expertise. One shared conviction.</h2>
          <p>The team was chosen because each member understands that a woman&apos;s outer expression and inner truth belong in conversation.</p>
        </header>
        <div className="about-team-grid">
          {team.map((member) => (
            <article key={member.name}>
              <img src={member.image} alt={member.name} loading="lazy" />
              <span>{member.number}</span>
              <h3>{member.name}</h3>
              <p>{member.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-closing section-shell">
        <p className="eyebrow">Begin With Trust</p>
        <h2>The work begins with being seen clearly.</h2>
        <p>If this approach feels like the kind of support you have been looking for, start with a simple conversation about your season and what kind of guidance would be most useful.</p>
        <div>
          <Link className="button button-primary" to="/contact">Get in Touch</Link>
          <Link className="button button-secondary" to="/experiences">Explore Experiences</Link>
        </div>
      </section>
    </main>
  )
}

export default About
