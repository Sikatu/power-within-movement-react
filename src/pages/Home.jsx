import { Link } from 'react-router-dom'
import heroImage from '../assets/images/hero.webp'
import storyImage from '../assets/images/story.webp'
import recognitionImage from '../assets/images/experiences-private-guidance.webp'
import { publicLinks } from '../config/publicLinks.js'
import './Home.css'

const layers = [
  {
    number: '01',
    title: 'Confidence',
    text: 'A steadier sense of self that does not have to be performed for anyone else.',
  },
  {
    number: '02',
    title: 'Energy',
    text: 'The foundation that supports how you live, lead, care, recover, and show up.',
  },
  {
    number: '03',
    title: 'Wellness',
    text: 'The daily practices and choices that help you feel supported from the inside out.',
  },
  {
    number: '04',
    title: 'Identity',
    text: 'An honest recognition of who you are now, not only who you have needed to be.',
  },
  {
    number: '05',
    title: 'Personal Presence',
    text: 'How your inner clarity becomes visible in the way you move, communicate, and present yourself.',
  },
  {
    number: '06',
    title: 'Lifestyle',
    text: 'The rhythms, relationships, environments, and choices that shape the life you are creating now.',
  },
]

const fiveRs = [
  {
    number: '01',
    title: 'Regulate',
    text: 'Create enough steadiness to notice what you need and how you want to move forward.',
  },
  {
    number: '02',
    title: 'Restore',
    text: 'Rebuild the energy, confidence, and personal foundation you have been giving from.',
  },
  {
    number: '03',
    title: 'Reconnect',
    text: 'Come back into relationship with the woman you have become, internally and externally.',
  },
  {
    number: '04',
    title: 'Reclaim',
    text: 'Strengthen your confidence, personal presence, voice, and sense of self.',
  },
  {
    number: '05',
    title: 'Reflect',
    text: 'Let your outer life express your identity, energy, values, and evolution more truthfully.',
  },
]

const beginOptions = [
  {
    number: '01',
    title: 'Start with Clarity',
    text: 'A focused one-hour conversation to name what no longer feels aligned and identify a thoughtful next step across confidence, wellness, style, and personal presence.',
    action: 'Book a Clarity Session',
    to: '/contact',
  },
  {
    number: '02',
    title: 'Radiance Reclaimed',
    text: 'A deeper whole-person experience for the woman ready to reconnect with herself in a more intentional, integrated, and elevated way.',
    action: 'Explore Radiance Reclaimed',
    to: '/radiance-reclaimed',
  },
]

function Home() {
  return (
    <main id="main-content" className="home-page">
      <section className="home-hero section-shell">
        <div className="home-hero-copy">
          <p className="eyebrow">Power Within Collective</p>
          <h1>
            You've lived capably for everyone else.
            <span> Now it's time to come alive for yourself.</span>
          </h1>
          <p className="home-hero-lead">
            Transformational experiences for women in a new season, bringing
            confidence, wellness, identity, style, and personal presence into
            one more integrated way of living.
          </p>

          <div className="home-hero-actions">
            <Link className="button button-primary" to="/experiences">
              Explore Experiences
            </Link>
            <Link className="button button-secondary" to="/contact">
              Book a Clarity Session
            </Link>
            <Link className="button button-text" to="/professionals">
              For Professionals
            </Link>
          </div>

          <div className="home-focus-tags" aria-label="Power Within focus areas">
            <span>Confidence</span>
            <span>Wellness</span>
            <span>Personal Presence</span>
          </div>
        </div>

        <div className="home-hero-visual">
          <span aria-hidden="true" />
          <img
            src={heroImage}
            alt="Woman in a calm and confident Power Within setting"
          />
        </div>
      </section>

      <section className="home-story section-shell">
        <div className="home-story-visual">
          <img
            src={storyImage}
            alt="Women having a thoughtful conversation"
          />
          <span aria-hidden="true" />
        </div>

        <div className="home-story-copy">
          <p className="eyebrow">Personal Presence</p>
          <h2>Let the way you show up reflect the woman you are now.</h2>
          <p>
            Responsibilities change. Priorities shift. Sometimes the life you
            built keeps moving while your sense of self quietly evolves beyond it.
          </p>
          <p>
            Confidence, wellness, style, and personal presence are connected.
            When they begin supporting one another, the way you move through
            everyday life can feel clearer, more current, and more intentional.
          </p>
          <p>
            This work is about reducing the distance between the woman you have
            become and the way your life expresses her.
          </p>
        </div>
      </section>

      <section className="home-layers">
        <div className="section-shell">
          <header className="section-heading">
            <p className="eyebrow">The Whole Woman</p>
            <h2>It is layered.</h2>
            <p>
              The work here considers the whole woman rather than treating
              confidence, wellness, identity, style, and personal presence as
              unrelated concerns.
            </p>
          </header>

          <div className="layer-grid">
            {layers.map((layer) => (
              <article key={layer.title}>
                <span>{layer.number}</span>
                <h3>{layer.title}</h3>
                <p>{layer.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-framework section-shell">
        <header className="section-heading">
          <p className="eyebrow">The 5Rs</p>
          <h2>A framework for bringing your inner and outer life back into alignment.</h2>
          <p>
            Each step creates room for greater clarity, self-possession, and
            intention in the way you live and present yourself.
          </p>
        </header>

        <div className="framework-grid">
          {fiveRs.map((item) => (
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
          <p className="eyebrow">Where Would You Like to Begin?</p>
          <h2>Choose the doorway that fits the season you are in.</h2>
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
            <p className="eyebrow">A New Season</p>
            <h2>You might be exactly who we're talking about.</h2>
            <p>
              You have handled real responsibilities, cared for people, adapted,
              led, worked, and kept moving. Capability is not the question.
            </p>
            <p>
              What may be calling for your attention now is the part of you that
              wants to feel current and fully present again, rather than simply
              continuing to manage an older version of yourself.
            </p>
            <p>
              You are not looking to be fixed. You are looking for a more honest
              way to inhabit the life and identity that are yours now.
            </p>
            <Link className="button button-secondary" to="/experiences">
              Explore Experiences
            </Link>
          </div>

          <div className="home-recognition-visual">
            <img
              src={recognitionImage}
              alt="A thoughtful private guidance experience"
            />
          </div>
        </div>
      </section>

      <section className="home-closing">
        <div className="home-closing-inner section-shell">
          <p className="eyebrow">The Invitation</p>
          <h2>Let your outer life become a more truthful expression of who you are now.</h2>
          <p>
            You have spent a long time doing what was required. Your next step
            can be less about performing well and more about living with
            intention, presence, and congruence.
          </p>

          <div className="home-closing-actions">
            <Link className="button button-primary" to="/experiences">
              Explore Experiences
            </Link>
            <Link className="button button-secondary" to="/contact">
              Book a Clarity Session
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
          <h2>Thoughtful resources for the season you are in.</h2>
        </header>

        <div className="home-connect-grid">
          <article className="home-connect-card home-connect-card-newsletter">
            <span>01</span>
            <h3>Notes for the woman in a new season.</h3>
            <p>
              Reflections on confidence, wellness, style, identity, personal
              presence, and the quieter work of returning to yourself.
            </p>
            <a
              className="button button-secondary"
              href={publicLinks.newsletter}
              target="_blank"
              rel="noreferrer"
            >
              Join the Newsletter
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