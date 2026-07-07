import PageHero from '../components/PageHero'
import ContactCTA from '../components/ContactCTA'
import kimImage from '../assets/images/kim.webp'
import corinneImage from '../assets/images/team/corinne.webp'
import danielleImage from '../assets/images/team/danielle.webp'
import kennyImage from '../assets/images/team/kenny.webp'

function About() {
  return (
    <main>
      <PageHero
        eyebrow="About"
        title="The foundation behind Power Within Collective™."
        text="A whole-person brand built around congruence, self-recognition, and the woman in a new season of life."
      />

      <section className="section story-section">
        <div className="story-grid">
          <div className="story-image">
            <img loading="lazy" src={kimImage} alt="Kim Mittelstadt founder of Power Within Collective" />
          </div>

          <div className="story-copy">
            <p className="eyebrow">Kim Mittelstadt</p>
            <h2>She saw that the right colors were not always enough.</h2>
            <p>For nearly four decades, Kim worked in beauty and image. She watched women receive the right colors, wardrobe guidance, and styling advice, yet still leave feeling disconnected from the woman in the mirror.</p>
            <p>Over time, she recognized a deeper truth: the outside can support a woman’s return, but it cannot complete what the inside has not begun.</p>
            <p>Her work now brings identity, wellness, color, style, and Personal Presence™ into one conversation.</p>
          </div>
        </div>
      </section>

      <section className="section intro-section">
        <div className="section-header">
          <p className="eyebrow">Earned Wisdom</p>
          <h2>Her work was shaped by real life, not theory alone.</h2>
          <p>Kim raised six children through military life, relocations, reinventions, and seasons that asked her to become someone new more than once. She learned that belonging is never worth the cost of self-abandonment.</p>
        </div>
      </section>

      <section className="section testimonial-section">
        <div className="testimonial-card">
          <p>“Confidence is not something you fix or force; it is something you reclaim.”</p>
          <span>Power Within Collective™</span>
        </div>
      </section>

      <section className="section experiences">
        <div className="section-header">
          <p className="eyebrow">The Collective Team</p>
          <h2>Different expertise. One shared conviction.</h2>
          <p>The team was chosen because each member understands that a woman’s outer expression and inner truth belong in conversation.</p>
        </div>

        <div className="cards">
          <article className="card team-card">
            <img loading="lazy" src={corinneImage} alt="Corinne McCausland" className="team-photo" />
            <span>01</span>
            <h3>Corinne McCausland</h3>
            <p>Wellness & Lifestyle Coach supporting women through full-life transitions with practical, grounded wellness.</p>
          </article>

          <article className="card team-card">
            <img loading="lazy" src={danielleImage} alt="Danielle Schonhoff" className="team-photo" />
            <span>02</span>
            <h3>Danielle Schonhoff</h3>
            <p>Photographer and Hair + Makeup Artist creating spaces where women feel like themselves before they see themselves.</p>
          </article>

          <article className="card team-card">
            <img loading="lazy" src={kennyImage} alt="Dr. Kenny Mittelstadt" className="team-photo" />
            <span>03</span>
            <h3>Dr. Kenny Mittelstadt</h3>
            <p>Root Cause Functional Medicine Practitioner with a systems-based view of energy, hormones, stress, digestion, and cellular health.</p>
          </article>
        </div>
      </section>

      <ContactCTA
        eyebrow="Begin With Trust"
        title="The work begins with being seen clearly."
        text="If this approach feels like the kind of support you have been looking for, start with a simple conversation about your season and what kind of guidance would be most useful."
        actions={[
          { label: 'Get in Touch', to: '/contact', variant: 'primary' },
          { label: 'Explore Experiences', to: '/experiences', variant: 'secondary' },
        ]}
      />
    </main>
  )
}

export default About
