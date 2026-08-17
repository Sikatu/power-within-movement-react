import { Link } from 'react-router-dom'
import radianceImage from '../assets/images/radiance.webp'
import privateGuidanceImage from '../assets/images/experiences-private-guidance.webp'
import colorImage from '../assets/images/color-analysis-swatches-session.webp'
import styleImage from '../assets/images/style-analysis-wardrobe-guidance.webp'
import kimImage from '../assets/images/kim.webp'
import './RadianceReclaimed.css'

const fitSignals = [
  {
    number: '01',
    title: 'Life has changed the context.',
    text: 'Your body, work, relationships, family, priorities, roles, or sense of self may be different from the chapter in which your current routines were built.',
  },
  {
    number: '02',
    title: 'The outside has not fully caught up.',
    text: 'Clothes, color, beauty choices, habits, or the way you enter a room may still work technically while no longer feeling completely current or recognizable.',
  },
  {
    number: '03',
    title: 'You want direction you can actually use.',
    text: 'You are not looking for reinvention. You want thoughtful choices that can move with you into real life after the experience ends.',
  },
]

const signatureMovement = [
  {
    number: '01',
    title: 'Recognize',
    text: 'See clearly who you are now, what has changed, what still belongs, and where the visible parts of life no longer feel aligned.',
  },
  {
    number: '02',
    title: 'Reclaim',
    text: 'Keep what is still true while reconnecting with expression, confidence, pleasure, possibility, and the freedom to choose differently.',
  },
  {
    number: '03',
    title: 'Radiate',
    text: 'Bring the woman you are now forward through intentional color, beauty, style, voice, self-expression, and Personal Presence.',
  },
  {
    number: '04',
    title: 'Remain',
    text: 'Leave with practical ways to stay connected to yourself as your body, priorities, relationships, and possibilities continue to evolve.',
  },
]

const retreatThreads = [
  {
    number: '01',
    title: 'Color + Beauty',
    text: 'Explore visible choices that help you feel current, polished, alive, and recognizably yourself rather than styled for someone else.',
    image: colorImage,
    alt: 'Personal color direction and swatches',
  },
  {
    number: '02',
    title: 'Style + Expression',
    text: 'Bring wardrobe, proportion, lifestyle, confidence, and self-expression into a direction that makes sense for the chapter you are actually living.',
    image: styleImage,
    alt: 'Personal style and wardrobe guidance',
  },
  {
    number: '03',
    title: 'Reflection + Integration',
    text: 'Connect the visible work to identity, voice, choice, and practical next steps so the experience continues beyond a beautiful moment.',
    image: privateGuidanceImage,
    alt: 'Personal Presence guidance in an intimate setting',
  },
]

function RadianceReclaimed() {
  return (
    <main id="main-content" className="radiance-page">
      <section className="rr-hero">
        <div className="section-shell rr-hero-grid">
          <div className="rr-hero-copy">
            <p className="eyebrow">
              Radiance Reclaimed&trade; Retreats
            </p>

            <h1>
              Recognize who you are now.
              <span> Bring that woman forward.</span>
            </h1>

            <p className="rr-hero-lead">
              An intimate Personal Presence retreat for women 45+ entering a
              new chapter, bringing reflection together with color, beauty,
              style, self-expression, connection, and intentional next-step
              choices.
            </p>

            <div className="rr-hero-actions">
              <Link
                className="button button-primary"
                to="/contact?interest=radiance"
              >
                Start a Radiance Reclaimed&trade; Conversation
              </Link>

              <Link
                className="button button-text"
                to="/experiences"
              >
                Explore Private Personal Presence
                <span aria-hidden="true"> &rarr;</span>
              </Link>
            </div>

            <p className="rr-hero-note">
              Not a makeover. Not reinvention. Recognition made visible.
            </p>
          </div>

          <div className="rr-hero-visual">
            <span aria-hidden="true" />

            <img
              src={radianceImage}
              alt="Radiance Reclaimed Personal Presence experience"
            />
          </div>
        </div>
      </section>

      <section className="rr-recognition">
        <div className="section-shell rr-recognition-grid">
          <div>
            <p className="eyebrow">The Real Shift</p>

            <h2>
              You are not starting over.
              <span> You are choosing what comes forward.</span>
            </h2>
          </div>

          <div className="rr-recognition-copy">
            <p>
              A new chapter can arrive before the way you dress, choose,
              express yourself, or move through the world has had time to
              catch up.
            </p>

            <p>
              Radiance Reclaimed creates space to recognize that gap without
              treating it as something wrong with you or something that needs
              to be erased.
            </p>

            <p>
              The work is to notice what still belongs, release what does not,
              and make the next choices more intentionally.
            </p>
          </div>
        </div>
      </section>

      <section className="rr-story section-shell">
        <div className="rr-story-visual">
          <img
            src={privateGuidanceImage}
            alt="Women receiving thoughtful Personal Presence guidance"
          />

          <span aria-hidden="true" />
        </div>

        <div className="rr-story-copy">
          <p className="eyebrow">Reclaimed Radiance</p>

          <h2>Radiance is not youth. It is aliveness and presence.</h2>

          <p>
            Radiance Reclaimed is not a generic mindset retreat, a fashion
            workshop, a spa weekend, or a promise that a different woman is
            waiting on the other side.
          </p>

          <p>
            It brings reflection and visible expression into the same
            conversation so color, beauty, style, confidence, voice, and
            everyday choice can become more truthful to the woman you are now.
          </p>

          <p className="rr-story-emphasis">
            The goal is not to become more impressive. It is to become more
            recognizable to yourself.
          </p>
        </div>
      </section>

      <section className="rr-fit section-shell">
        <header className="rr-section-heading">
          <p className="eyebrow">Who It Is For</p>

          <h2>
            For the woman who does not need reinvention.
            She needs recognition and direction.
          </h2>

          <p>
            You may recognize yourself in one of these places, or in several
            of them at once.
          </p>
        </header>

        <div className="rr-fit-grid">
          {fitSignals.map((item) => (
            <article key={item.title}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rr-movement">
        <div className="section-shell">
          <header className="rr-section-heading rr-movement-heading">
            <p className="eyebrow">The Signature Movement</p>

            <h2>Recognize. Reclaim. Radiate. Remain.</h2>

            <p>
              The experience moves from self-recognition into visible
              expression, then into choices that can remain useful as life
              continues to evolve.
            </p>
          </header>

          <div className="rr-movement-grid">
            {signatureMovement.map((chapter) => (
              <article key={chapter.title}>
                <span>{chapter.number}</span>

                <div>
                  <h3>{chapter.title}</h3>
                  <p>{chapter.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rr-inside section-shell">
        <header className="rr-section-heading">
          <p className="eyebrow">Inside Radiance</p>

          <h2>
            Different parts of you belong in the same conversation.
          </h2>

          <p>
            Radiance brings visible Personal Presence work together with
            reflection and practical integration rather than treating each
            part as a separate problem to solve.
          </p>
        </header>

        <div className="rr-thread-grid">
          {retreatThreads.map((thread) => (
            <article key={thread.title}>
              <div className="rr-thread-image">
                <img
                  src={thread.image}
                  alt={thread.alt}
                />
              </div>

              <span>{thread.number}</span>
              <h3>{thread.title}</h3>
              <p>{thread.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rr-quote">
        <div className="section-shell">
          <blockquote>
            <p>
              You are not starting over.
              You are returning to yourself.
            </p>

            <cite>Power Within Collective&trade;</cite>
          </blockquote>
        </div>
      </section>

      <section className="rr-guide">
        <div className="section-shell rr-guide-grid">
          <div className="rr-guide-visual">
            <img
              src={kimImage}
              alt="Kim Mittelstadt, founder of Power Within Collective"
            />
          </div>

          <div className="rr-guide-copy">
            <p className="eyebrow">Guided by Kim Mittelstadt</p>

            <h2>
              The right colors were never the whole answer.
            </h2>

            <p>
              Kim brings nearly four decades of experience across beauty,
              image, color, teaching, speaking, coaching, and women-centered
              work into a more complete question:
            </p>

            <p className="rr-guide-question">
              What helps the outside feel more truthful to the woman you have
              become?
            </p>

            <p>
              Radiance Reclaimed brings that question into an intimate,
              elevated experience designed to remain connected to real life.
            </p>

            <Link
              className="button button-secondary"
              to="/about"
            >
              Meet Kim
            </Link>
          </div>
        </div>
      </section>

      <section className="rr-final">
        <div className="section-shell rr-final-inner">
          <p className="eyebrow">The Invitation</p>

          <h2>
            You do not need to know exactly what comes next.
          </h2>

          <p>
            If Radiance Reclaimed feels relevant to the chapter you are in,
            begin with a conversation about what has changed, what no longer
            feels current, and what you want to understand more clearly.
          </p>

          <div className="rr-final-actions">
            <Link
              className="button rr-final-primary"
              to="/contact?interest=radiance"
            >
              Start a Radiance Reclaimed&trade; Conversation
            </Link>

            <Link
              className="button rr-final-secondary"
              to="/experiences"
            >
              Explore Private Personal Presence
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default RadianceReclaimed
