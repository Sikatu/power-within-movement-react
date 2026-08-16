import { Link } from 'react-router-dom'
import kimImage from '../assets/images/kim.webp'
import presentationImage from '../assets/images/power-within-group-presentation.webp'
import corinneImage from '../assets/images/team/corinne.webp'
import danielleImage from '../assets/images/team/danielle.webp'
import kennyImage from '../assets/images/team/kenny.webp'
import './About.css'

const authoritySignals = [
  {
    number: '01',
    title: 'Nearly four decades',
    text: 'Beauty and image experience shaped by years of seeing how women respond to color, style, visibility, and change.',
  },
  {
    number: '02',
    title: 'A life lived through change',
    text: 'Kim raised six children through military life, relocations, reinventions, and seasons that required beginning differently more than once.',
  },
  {
    number: '03',
    title: 'The whole woman in view',
    text: 'Identity, wellness, color, style, confidence, and Personal Presence brought into one integrated conversation.',
  },
]

const presencePrinciples = [
  {
    number: '01',
    title: 'Visible choices matter.',
    text: 'Color, beauty, wardrobe, and expression affect how a woman experiences herself and how she moves through everyday life.',
  },
  {
    number: '02',
    title: 'Context matters too.',
    text: 'The right answer changes when the body, lifestyle, priorities, relationships, roles, or season around the woman have changed.',
  },
  {
    number: '03',
    title: 'Recognition matters more than reinvention.',
    text: 'The goal is not a newer persona. It is a more current and recognizable expression of the woman who is already there.',
  },
]

const team = [
  {
    number: '01',
    name: 'Corinne McCausland',
    role: 'Wellness & Lifestyle Coach',
    image: corinneImage,
    text: 'Supporting women through full-life transitions with practical, grounded wellness.',
  },
  {
    number: '02',
    name: 'Danielle Schonhoff',
    role: 'Photographer + Hair & Makeup Artist',
    image: danielleImage,
    text: 'Creating spaces where women feel like themselves before they see themselves.',
  },
  {
    number: '03',
    name: 'Dr. Kenny Mittelstadt',
    role: 'Functional Medicine Practitioner',
    image: kennyImage,
    text: 'Bringing a systems-based view of energy, hormones, stress, digestion, and cellular health.',
  },
]

function About() {
  return (
    <main id="main-content" className="about-page">
      <section className="about-hero">
        <div className="section-shell about-hero-grid">
          <div className="about-hero-copy">
            <p className="eyebrow">
              Kim Mittelstadt | Founder
            </p>

            <h1>
              The work became
              <span> bigger than color.</span>
            </h1>

            <p className="about-hero-lead">
              For nearly four decades, Kim has worked in beauty and image,
              paying attention not only to what looked right, but to what
              helped a woman feel recognizable to herself.
            </p>

            <p className="about-hero-support">
              Over time, one pattern became impossible to ignore: the right
              colors, wardrobe guidance, and styling could help, but they
              could not create recognition on their own.
            </p>

            <div className="about-hero-actions">
              <Link
                className="button button-primary"
                to="/experiences"
              >
                Explore Personal Presence
              </Link>

              <Link
                className="button button-text"
                to="/contact"
              >
                Start a Conversation
                <span aria-hidden="true"> &rarr;</span>
              </Link>
            </div>
          </div>

          <div className="about-hero-visual">
            <span aria-hidden="true" />

            <img
              src={kimImage}
              alt="Kim Mittelstadt, founder of Power Within Collective"
            />
          </div>
        </div>
      </section>

      <section className="about-authority">
        <div className="section-shell about-authority-grid">
          {authoritySignals.map((signal) => (
            <article key={signal.number}>
              <span>{signal.number}</span>

              <h2>{signal.title}</h2>

              <p>{signal.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-origin section-shell">
        <div className="about-origin-visual">
          <img
            src={presentationImage}
            alt="Power Within group presentation"
          />

          <span aria-hidden="true" />
        </div>

        <div className="about-origin-copy">
          <p className="eyebrow">What the Work Revealed</p>

          <h2>
            She saw that the right colors were not always enough.
          </h2>

          <p>
            Women could receive technically sound color direction,
            wardrobe guidance, or styling advice and still feel
            disconnected from the woman looking back at them.
          </p>

          <p>
            The visible answer mattered. But it was only part of the
            conversation.
          </p>

          <blockquote>
            The outside can support a woman&apos;s return, but it cannot
            complete what the inside has not begun.
          </blockquote>
        </div>
      </section>

      <section className="about-presence">
        <div className="section-shell">
          <header className="about-presence-heading">
            <p className="eyebrow">Why Personal Presence&trade;</p>

            <h2>
              The woman and the visible choices belong in the same
              conversation.
            </h2>

            <p>
              Kim&apos;s work now brings identity, wellness, color, style,
              confidence, and visible expression together instead of
              treating each one as an isolated problem to solve.
            </p>
          </header>

          <div className="about-presence-grid">
            {presencePrinciples.map((principle) => (
              <article key={principle.number}>
                <span>{principle.number}</span>

                <h3>{principle.title}</h3>

                <p>{principle.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-wisdom">
        <div className="section-shell about-wisdom-grid">
          <div>
            <p className="eyebrow">Earned Wisdom</p>

            <h2>
              Her work was shaped by real life, not theory alone.
            </h2>
          </div>

          <div className="about-wisdom-copy">
            <p>
              Kim raised six children through military life,
              relocations, reinventions, and seasons that asked her
              to become someone new more than once.
            </p>

            <p>
              Those chapters taught her that change does not always
              require throwing everything away. Sometimes the more
              meaningful work is recognizing what still belongs and
              choosing what comes forward.
            </p>

            <p>
              She learned that belonging is never worth the cost of
              self-abandonment.
            </p>
          </div>
        </div>

        <div className="section-shell about-belief">
          <blockquote>
            <p>
              Confidence is not something you fix or force.
              It is something you reclaim.
            </p>

            <cite>Power Within Collective&trade;</cite>
          </blockquote>
        </div>
      </section>

      <section className="about-team section-shell">
        <header className="about-section-heading">
          <p className="eyebrow">The Collective Team</p>

          <h2>
            Kim leads the vision.
            The Collective brings complementary perspectives.
          </h2>

          <p>
            Power Within includes people whose work touches different
            parts of a woman&apos;s experience while respecting that no
            single discipline explains the whole person.
          </p>
        </header>

        <div className="about-team-grid">
          {team.map((member) => (
            <article key={member.name}>
              <div className="about-team-image">
                <img
                  src={member.image}
                  alt={member.name}
                  loading="lazy"
                />
              </div>

              <div className="about-team-meta">
                <span>{member.number}</span>
                <p>{member.role}</p>
              </div>

              <h3>{member.name}</h3>

              <p className="about-team-description">
                {member.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-closing">
        <div className="section-shell about-closing-inner">
          <p className="eyebrow">Begin With Trust</p>

          <h2>
            The next step is not to become someone else.
          </h2>

          <p>
            If Kim&apos;s approach feels relevant to the chapter you are
            in, begin with a conversation about what has changed,
            what no longer feels current, and what kind of guidance
            would be most useful now.
          </p>

          <div className="about-closing-actions">
            <Link
              className="button button-primary"
              to="/contact"
            >
              Start a Conversation
            </Link>

            <Link
              className="button button-secondary"
              to="/experiences"
            >
              Explore Personal Presence
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default About
