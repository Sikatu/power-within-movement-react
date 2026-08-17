import { Link } from 'react-router-dom'
import privateGuidanceImage from '../assets/images/experiences-private-guidance.webp'
import colorImage from '../assets/images/color-analysis-swatches-session.webp'
import styleImage from '../assets/images/style-analysis-wardrobe-guidance.webp'
import makeupImage from '../assets/images/blend-cosmetics-makeup-direction.webp'
import consultationImage from '../assets/images/consultation-detail.webp'
import './Experiences.css'

const pathways = [
  {
    number: '01',
    eyebrow: 'Color + Beauty',
    title: 'See yourself more clearly in color, makeup, and beauty choices.',
    text: 'For women who want practical direction around personal color, undertones, makeup, hair direction, and beauty choices that feel current and repeatable.',
    image: colorImage,
    alt: 'Personal color analysis and palette guidance',
    actions: [
      {
        label: 'Explore Color Analysis',
        to: '/color-analysis',
      },
      {
        label: 'Explore Makeup Direction',
        to: '/blend-cosmetics',
      },
    ],
  },
  {
    number: '02',
    eyebrow: 'Style + Wardrobe',
    title: 'Dress the body and life you are living now.',
    text: 'For women whose body, lifestyle, priorities, or sense of style have changed and who want clearer direction around proportion, silhouettes, wardrobe structure, and everyday confidence.',
    image: styleImage,
    alt: 'Personal style and wardrobe guidance',
    actions: [
      {
        label: 'Explore Style + Body Analysis',
        to: '/style-analysis',
      },
    ],
  },
]

const integratedSignals = [
  'The question is bigger than one outfit, palette, or makeup routine.',
  'Color, beauty, wardrobe, confidence, and lifestyle all feel connected.',
  'You want someone to help you see what works for the woman you are now.',
]

function Experiences() {
  return (
    <main id="main-content" className="presence-page">
      <section className="pp-hero">
        <div className="section-shell pp-hero-grid">
          <div className="pp-hero-copy">
            <p className="eyebrow">
              Private Personal Presence&trade;
            </p>

            <h1>
              Practical guidance for the woman
              <span> you are now.</span>
            </h1>

            <p className="pp-hero-lead">
              One-to-one experiences for the visible questions that arise
              when life has changed faster than the way you dress, choose,
              or show up.
            </p>

            <div className="pp-hero-actions">
              <a
                className="button button-primary"
                href="#private-pathways"
              >
                Explore Private Pathways
              </a>

              <Link
                className="button button-text"
                to="/radiance-reclaimed"
              >
                Looking for something deeper?
                <span aria-hidden="true"> &rarr;</span>
              </Link>
            </div>

            <p className="pp-hero-note">
              Color. Beauty. Style. Wardrobe. Confidence. Personal Presence.
            </p>
          </div>

          <div className="pp-hero-visual">
            <span aria-hidden="true" />

            <img
              src={privateGuidanceImage}
              alt="Private Personal Presence guidance"
            />
          </div>
        </div>
      </section>

      <section className="pp-context">
        <div className="section-shell pp-context-grid">
          <div>
            <p className="eyebrow">A Practical Place to Begin</p>

            <h2>
              Sometimes the first question is visible.
              <span> That does not make it superficial.</span>
            </h2>
          </div>

          <div className="pp-context-copy">
            <p>
              A wardrobe can stop making sense. Makeup can begin to feel
              dated or complicated. Colors that once worked can feel less
              certain. A changing body can make familiar silhouettes harder
              to trust.
            </p>

            <p>
              Private Personal Presence starts with the question you can
              actually see, then considers the body, lifestyle, priorities,
              confidence, and chapter around it.
            </p>

            <p>
              You do not need to overhaul everything. You need direction that
              is useful, personal, and recognizable.
            </p>
          </div>
        </div>
      </section>

      <section
        id="private-pathways"
        className="pp-pathways section-shell scroll-target"
      >
        <header className="pp-section-heading">
          <p className="eyebrow">Two Focused Doors</p>

          <h2>Start with the part that feels most visible right now.</h2>

          <p>
            Each pathway is focused enough to be practical while still
            considering the woman, body, lifestyle, and season around the
            question.
          </p>
        </header>

        <div className="pp-pathway-list">
          {pathways.map((pathway) => (
            <article
              className="pp-pathway"
              key={pathway.title}
            >
              <div className="pp-pathway-image">
                <img
                  src={pathway.image}
                  alt={pathway.alt}
                />
              </div>

              <div className="pp-pathway-copy">
                <div className="pp-pathway-meta">
                  <span>{pathway.number}</span>
                  <p>{pathway.eyebrow}</p>
                </div>

                <h3>{pathway.title}</h3>
                <p>{pathway.text}</p>

                <div className="pp-pathway-actions">
                  {pathway.actions.map((action) => (
                    <Link
                      key={action.to}
                      to={action.to}
                    >
                      {action.label}
                      <span aria-hidden="true"> &rarr;</span>
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="pp-integrated">
        <div className="section-shell pp-integrated-grid">
          <div className="pp-integrated-copy">
            <p className="eyebrow">
              Integrated Personal Presence
            </p>

            <h2>
              When the question crosses more than one category.
            </h2>

            <p>
              Sometimes you already know the issue is not only color, only
              makeup, or only wardrobe. Several visible pieces have shifted
              at once, and you want one thoughtful conversation around how
              they fit together.
            </p>

            <ul>
              {integratedSignals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>

            <Link
              className="button pp-integrated-button"
              to="/contact"
            >
              Start a Private Personal Presence Conversation
            </Link>
          </div>

          <div className="pp-integrated-visual">
            <img
              src={consultationImage}
              alt="Personal Presence consultation materials"
            />

            <div>
              <p>Not sure which focused pathway fits?</p>
              <strong>
                You do not need to diagnose the problem before reaching out.
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="pp-beauty section-shell">
        <div className="pp-beauty-visual">
          <img
            src={makeupImage}
            alt="Personal makeup and beauty direction"
          />
        </div>

        <div className="pp-beauty-copy">
          <p className="eyebrow">Beauty With Meaning</p>

          <h2>
            Looking current should still feel like looking like yourself.
          </h2>

          <p>
            Personal Presence does not ask you to become trendier, younger,
            or more polished for someone else's approval.
          </p>

          <p>
            The work is to understand which visible choices support your
            features, body, lifestyle, confidence, and expression so getting
            dressed or ready becomes clearer rather than more complicated.
          </p>
        </div>
      </section>

      <section className="pp-radiance">
        <div className="section-shell pp-radiance-inner">
          <p className="eyebrow">
            The Signature Experience
          </p>

          <h2>
            When the question is deeper than how you look.
          </h2>

          <p>
            Radiance Reclaimed&trade; brings reflection, color, beauty,
            style, self-expression, connection, and practical integration
            into one intimate Personal Presence retreat for women entering
            a new chapter.
          </p>

          <Link
            className="button pp-radiance-button"
            to="/radiance-reclaimed"
          >
            Explore Radiance Reclaimed&trade;
          </Link>
        </div>
      </section>

      <section className="pp-final">
        <div className="section-shell pp-final-grid">
          <div>
            <p className="eyebrow">A Simple Next Step</p>

            <h2>You do not have to know which door is right yet.</h2>
          </div>

          <div>
            <p>
              If you know what you want, explore the focused experience that
              matches it. If you do not, begin with a conversation about what
              has changed and what no longer feels current.
            </p>

            <Link
              className="button button-primary"
              to="/contact"
            >
              Start a Conversation
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Experiences
