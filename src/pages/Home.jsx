import { Link } from 'react-router-dom'
import heroImage from '../assets/images/hero.webp'
import storyImage from '../assets/images/story.webp'
import recognitionImage from '../assets/images/power-within-group-presentation.webp'
import { publicLinks } from '../config/publicLinks.js'
import './Home.css'

const presenceDoors = [
  {
    number: '01',
    title: 'Color + Beauty',
    text: 'Understand the colors, makeup, and beauty choices that help you feel current, polished, and recognizably yourself.',
  },
  {
    number: '02',
    title: 'Style + Wardrobe',
    text: 'Create a wardrobe direction that fits your body, lifestyle, priorities, and the chapter you are actually living now.',
  },
  {
    number: '03',
    title: 'Presence + Choice',
    text: 'Bring your confidence, voice, self-expression, and everyday choices into closer alignment with who you are now.',
  },
]

const signatureMovement = [
  {
    number: '01',
    title: 'Recognize',
    text: 'See clearly what has changed, what still feels true, and where your visible life no longer reflects the woman you are now.',
  },
  {
    number: '02',
    title: 'Reclaim',
    text: 'Keep what still belongs to you while releasing habits, expectations, and expressions that belong to an earlier chapter.',
  },
  {
    number: '03',
    title: 'Radiate',
    text: 'Bring the woman you are now forward through color, beauty, style, voice, confidence, and personal presence.',
  },
  {
    number: '04',
    title: 'Remain',
    text: 'Build practical ways to stay connected to yourself as your life, body, priorities, and possibilities continue to evolve.',
  },
]

const beginOptions = [
  {
    number: '01',
    title: 'Radiance Reclaimed Retreats',
    text: 'The signature Personal Presence retreat for women entering a new chapter, bringing reflection together with color, beauty, style, self-expression, and practical next-step integration.',
    action: 'Explore Radiance Reclaimed Retreats',
    to: '/radiance-reclaimed',
  },
  {
    number: '02',
    title: 'Private Personal Presence Experiences',
    text: 'One-to-one guidance around color, beauty, style, wardrobe, confidence, and the visible questions that arise when life has changed faster than the way you show up.',
    action: 'Explore Private Experiences',
    to: '/experiences',
  },
]

function Home() {
  return (
    <main id="main-content" className="home-page">
      <section className="home-hero section-shell">
        <div className="home-hero-copy">
          <p className="eyebrow">Power Within Collective</p>

          <h1>
            You have changed.
            <span> Has the way you show up changed with you?</span>
          </h1>

          <p className="home-hero-lead">
            Personal Presence for women 45+ entering a new chapter, bringing
            color, beauty, style, self-expression, and everyday choices back
            into conversation with who you are now.
          </p>

          <div className="home-hero-actions">
            <Link
              className="button button-primary"
              to="/radiance-reclaimed"
            >
              Explore Radiance Reclaimed&trade;
            </Link>

            <Link
              className="button button-text"
              to="/experiences"
            >
              Private Personal Presence&trade;
            </Link>
          </div>

          <p className="home-audience-note">
            For women in midlife and beyond who want to feel current,
            expressive, and recognizable again.
          </p>
        </div>

        <div className="home-hero-visual">
          <span aria-hidden="true" />
          <img
            src={heroImage}
            alt="Woman in a calm and confident Power Within setting"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </section>

      <section className="home-story section-shell">
        <div className="home-story-visual">
          <img
            src={storyImage}
            alt="Women having a thoughtful conversation"
            loading="lazy"
            fetchPriority="low"
            decoding="async"
          />
          <span aria-hidden="true" />
        </div>

        <div className="home-story-copy">
          <p className="eyebrow">Personal Presence&trade;</p>

          <h2>The woman you are now deserves to be visible.</h2>

          <p>
            Life can change faster than the way we dress, choose, or show up.
            A wardrobe that once made sense can begin to feel disconnected.
            The same can happen with color, hair, makeup, routines, or the way
            you enter a room.
          </p>

          <p>
            Personal Presence brings those visible questions into one
            practical conversation with identity, confidence, lifestyle,
            voice, and self-expression.
          </p>

          <p>
            The goal is not a younger version of you. It is a more current
            and recognizable one.
          </p>
        </div>
      </section>

      <section className="home-layers">
        <div className="section-shell">
          <header className="section-heading">
            <p className="eyebrow">Personal Presence, Practically</p>
            <h2>Start where the disconnect is visible.</h2>
            <p>
              You may arrive with a color, wardrobe, beauty, or confidence
              question. The direction becomes useful when the answer fits
              your real body, real lifestyle, and real chapter.
            </p>
          </header>

          <div className="layer-grid">
            {presenceDoors.map((door) => (
              <article key={door.title}>
                <span>{door.number}</span>
                <h3>{door.title}</h3>
                <p>{door.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-framework section-shell">
        <header className="section-heading">
          <p className="eyebrow">Radiance Reclaimed&trade;</p>
          <h2>Recognize. Reclaim. Radiate. Remain.</h2>
          <p>
            A signature movement for turning self-recognition into visible,
            practical choices that can continue with you as life evolves.
          </p>
        </header>

        <div className="framework-grid">
          {signatureMovement.map((item) => (
            <article key={item.title}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-begin section-shell">
        <header className="section-heading">
          <p className="eyebrow">Ways to Work Together</p>
          <h2>One signature invitation. One private pathway.</h2>
        </header>

        <div className="begin-grid">
          {beginOptions.map((option) => (
            <Link to={option.to} key={option.title}>
              <span>{option.number}</span>
              <h3>{option.title}</h3>
              <p>{option.text}</p>
              <strong>
                {option.action} <span aria-hidden="true">&rarr;</span>
              </strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-recognition">
        <div className="home-recognition-grid section-shell">
          <div className="home-recognition-copy">
            <p className="eyebrow">A New Chapter</p>

            <h2>You are not starting over. You are choosing what stays.</h2>

            <p>
              You have already lived enough life to know that change does not
              require throwing everything away. Experience, relationships,
              wisdom, and the parts of yourself that still fit get to come
              forward with you.
            </p>

            <p>
              Maybe your body, work, family, relationships, priorities, or
              sense of self have shifted. The clothes, beauty routines, or
              habits that once worked may simply belong to an earlier chapter.
            </p>

            <p>
              The goal is to feel current, not trendy; visible, not exposed;
              recognizable, not reinvented.
            </p>

            <Link
              className="button button-secondary"
              to="/radiance-reclaimed"
            >
              Explore Radiance Reclaimed&trade;
            </Link>
          </div>

          <div className="home-recognition-visual">
            <img
              src={recognitionImage}
              alt="A Power Within gathering with a facilitator speaking to a group"
              loading="lazy"
              fetchPriority="low"
              decoding="async"
            />
          </div>
        </div>
      </section>

      <section className="home-closing">
        <div className="home-closing-inner section-shell">
          <p className="eyebrow">The Invitation</p>

          <h2>Current, not trendy. Recognizable, not reinvented.</h2>

          <p>
            Radiance is not youth. It is the aliveness that becomes visible
            when the way you look, live, choose, and show up feels more like
            you again.
          </p>

          <div className="home-closing-actions">
            <Link
              className="button button-primary"
              to="/radiance-reclaimed"
            >
              Explore Radiance Reclaimed&trade;
            </Link>
          </div>
        </div>
      </section>

      <section
        id="newsletter"
        className="home-connect section-shell scroll-target"
      >
        <header className="section-heading">
          <p className="eyebrow">Stay Connected</p>
          <h2>Useful ideas for the chapter you are in.</h2>
        </header>

        <div className="home-connect-grid">
          <article className="home-connect-card home-connect-card-newsletter">
            <span>01</span>
            <h3>The Power Within Edit</h3>
            <p>
              Thoughtful notes on Personal Presence, color, beauty, style,
              confidence, self-expression, and choosing what comes next.
            </p>

            <a
              className="button button-secondary"
              href={publicLinks.newsletter}
              target="_blank"
              rel="noreferrer"
            >
              Join The Power Within Edit
            </a>
          </article>

          <article className="home-connect-card home-connect-card-resource">
            <span>02</span>
            <h3>100 Conversation Starters</h3>
            <p>
              A free resource created to open more meaningful conversations,
              reflection, connection, and curiosity.
            </p>

            <a
              className="button button-secondary"
              href={publicLinks.conversationStarters}
              target="_blank"
              rel="noreferrer"
            >
              Get the Free Resource
            </a>
          </article>
        </div>
      </section>
    </main>
  )
}

export default Home
