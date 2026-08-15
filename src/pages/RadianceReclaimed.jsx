import { Link } from 'react-router-dom'
import privateGuidanceImage from '../assets/images/experiences-private-guidance.webp'
import radianceImage from '../assets/images/radiance.webp'
import './SignatureExperiences.css'

const retreatFit = [
  {
    number: '01',
    title: 'A Woman in a New Chapter',
    text: 'Life, body, roles, priorities, relationships, work, or identity have shifted, and she wants the way she shows up to feel current again.',
  },
  {
    number: '02',
    title: 'A Woman Whose Outside Has Not Caught Up',
    text: 'Her wardrobe, beauty choices, or visible expression still make sense on paper, but no longer feel fully recognizable in real life.',
  },
  {
    number: '03',
    title: 'A Woman Ready for Practical Expression',
    text: 'She wants more than inspiration. She wants useful direction she can carry into color, beauty, style, choices, and everyday presence.',
  },
]

const signatureMovement = [
  {
    number: '01',
    title: 'Recognize',
    text: 'See who you are now, what has changed, and what the current chapter is asking you to notice.',
  },
  {
    number: '02',
    title: 'Reclaim',
    text: 'Keep what still belongs, release what no longer fits, and reconnect with expression, pleasure, confidence, and choice.',
  },
  {
    number: '03',
    title: 'Radiate',
    text: 'Bring that woman forward through intentional color, beauty, style, voice, self-expression, and Personal Presence.',
  },
  {
    number: '04',
    title: 'Remain',
    text: 'Leave with practical ways to stay connected to yourself as your life continues to evolve.',
  },
]

function RadianceReclaimed() {
  return (
    <main id="main-content" className="signature-page radiance-page">
      <section className="signature-family-hero section-shell">
        <p className="eyebrow">Radiance Reclaimed&trade; Retreats</p>

        <h1>
          A Personal Presence retreat for the woman entering a new chapter.
        </h1>

        <p>
          Recognize who you are now and bring that woman forward through
          intentional color, beauty, style, reflection, self-expression,
          connection, and practical next-chapter choices.
        </p>
      </section>

      <section className="radiance-experience">
        <div className="section-shell">
          <header className="radiance-intro">
            <p className="eyebrow">The Signature Experience</p>

            <h2>Recognize who you are now. Bring that woman forward.</h2>

            <p>
              Radiance Reclaimed is an intimate Personal Presence retreat for
              women who have changed and want the way they look, live, choose,
              and show up to feel recognizable again.
            </p>

            <Link
              className="button radiance-gold-button"
              to="/contact?interest=radiance"
            >
              Start a Radiance Reclaimed&trade; Conversation
            </Link>
          </header>

          <div className="radiance-story-grid">
            <img
              src={radianceImage}
              alt="Radiance Reclaimed Personal Presence experience"
            />

            <div>
              <p className="eyebrow">Reclaimed Radiance</p>

              <h3>Radiance is not youth. It is aliveness and presence.</h3>

              <p>
                This is not a generic mindset retreat, fashion workshop, spa
                weekend, or promise to become a different woman.
              </p>

              <p>
                Color, beauty, style, self-expression, reflection, and
                practical choices come together so the outside can become a
                more truthful expression of the woman you are now.
              </p>
            </div>
          </div>

          <section className="radiance-fit">
            <header className="radiance-section-heading">
              <p className="eyebrow">Who It Is For</p>

              <h3>
                For the woman who does not need reinvention. She needs
                recognition and direction.
              </h3>

              <p>
                The retreat is designed for mature women who want beauty and
                depth, but also want the experience to land in real life.
              </p>
            </header>

            <div className="radiance-card-grid">
              {retreatFit.map((card) => (
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
              <p className="eyebrow">The Signature Movement</p>

              <h3>Recognize. Reclaim. Radiate. Remain.</h3>

              <p>
                The experience moves from recognition into practical visible
                expression, then into choices that can continue after the
                retreat itself.
              </p>
            </header>

            <div className="radiance-chapters">
              {signatureMovement.map((chapter) => (
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
            <p>
              You are not starting over. You are returning to yourself.
            </p>
            <cite>Power Within Collective&trade;</cite>
          </blockquote>

          <div className="radiance-guided-grid">
            <div>
              <p className="eyebrow">Inside the Retreat</p>

              <h3>Intimate, beautiful, useful, and grounded in real life.</h3>

              <p>
                Expect space for reflection and connection alongside visible
                Personal Presence application through color, beauty, style,
                self-expression, and the choices shaping your next chapter.
              </p>

              <p>
                The experience is designed to feel elevated without becoming
                performative, therapeutic, or disconnected from everyday life.
              </p>
            </div>

            <img
              src={privateGuidanceImage}
              alt="Personal Presence guidance in an intimate setting"
            />
          </div>

          <section className="radiance-begin">
            <p className="eyebrow">How to Begin</p>

            <h3>Explore first. Begin the conversation when it feels relevant.</h3>

            <p>
              You do not need to arrive with the perfect explanation. Share
              what is changing, what no longer feels current, and what you
              would like to understand more clearly.
            </p>

            <div>
              <Link
                className="button radiance-gold-button"
                to="/contact?interest=radiance"
              >
                Start a Radiance Reclaimed&trade; Conversation
              </Link>

              <Link
                className="button radiance-outline-button"
                to="/experiences"
              >
                Explore Private Personal Presence
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default RadianceReclaimed
