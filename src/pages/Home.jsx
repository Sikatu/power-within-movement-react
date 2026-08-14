import { Link } from 'react-router-dom'
import heroImage from '../assets/images/hero.webp'
import storyImage from '../assets/images/story.webp'
import recognitionImage from '../assets/images/power-within-group-presentation.webp'
import { publicLinks } from '../config/publicLinks.js'
import './Home.css'

const layers = [
  {
    number: '01',
    title: 'Confidence',
    text: 'Confidence grows when your inner sense of self and the way you show up begin supporting one another.',
  },
  {
    number: '02',
    title: 'Energy',
    text: 'The physical and emotional capacity that shapes how you live, care, lead, recover, and engage with life.',
  },
  {
    number: '03',
    title: 'Wellness',
    text: 'The practices and support that help you feel grounded, resourced, and cared for from the inside out.',
  },
  {
    number: '04',
    title: 'Identity',
    text: 'A clearer relationship with who you are becoming, beyond the roles and expectations you have carried.',
  },
  {
    number: '05',
    title: 'Personal Presence',
    text: 'The way your confidence, identity, energy, and self-awareness become visible in how you move through the world.',
  },
  {
    number: '06',
    title: 'Lifestyle',
    text: 'The rhythms, environments, relationships, and choices that support the life you want to inhabit now.',
  },
]

const fiveRs = [
  {
    number: '01',
    title: 'Regulate',
    text: 'Create enough clarity and steadiness to decide how you want to move through life and show up now.',
  },
  {
    number: '02',
    title: 'Restore',
    text: 'Rebuild the energy, confidence, and personal foundation that allow you to give from a more supported place.',
  },
  {
    number: '03',
    title: 'Reconnect',
    text: 'Realign your inner experience and outer expression with the woman you have become.',
  },
  {
    number: '04',
    title: 'Reclaim',
    text: 'Strengthen your confidence, personal presence, voice, and relationship with your own sense of self.',
  },
  {
    number: '05',
    title: 'Reflect',
    text: 'Allow your outer life to communicate your identity, energy, values, and evolution more authentically.',
  },
]

const beginOptions = [
  {
    number: '01',
    title: 'Start with Clarity',
    text: 'A one-hour whole-person conversation to identify what no longer feels aligned and begin mapping a more intentional path forward across confidence, wellness, style, and personal presence.',
    action: 'Book a Clarity Session',
    to: '/contact',
  },
  {
    number: '02',
    title: 'Radiance Reclaimed',
    text: 'A transformational experience for the woman ready to reconnect confidence, wellness, style, and personal presence in a more intentional and integrated way.',
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
            Transformational experiences designed for women who are ready to
            stop performing their lives and start inhabiting them.
          </p>

          <div className="home-hero-actions">
            <Link className="button button-primary" to="/experiences">
              Explore Experiences
            </Link>
            <Link className="button button-text" to="/professionals">
              For Professionals
            </Link>
          </div>

          <div className="home-focus-tags" aria-label="Power Within audiences">
            <span>For women in a new season.</span>
            <span>For beauty professionals ready to lead differently.</span>
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
          <h2>
            Personal presence begins when the outside finally reflects the
            woman you've become.
          </h2>

          <p>
            Your responsibilities have changed. Your priorities have shifted.
            And somewhere along the way, the way you show up stopped reflecting
            who you've actually become.
          </p>

          <p>
            Most women in this season don't need more information, a better
            morning routine, or someone to tell them they're enough. What they
            need is to close the gap between the life they're living and the
            life that finally feels true.
          </p>

          <p>
            Confidence. Wellness. Personal presence. Style. These aren't
            separate problems. They're different expressions of one life.
            When they begin working together, something durable shifts.
          </p>
        </div>
      </section>

      <section className="home-layers">
        <div className="section-shell">
          <header className="section-heading">
            <p className="eyebrow">The Whole Woman</p>
            <h2>It is layered.</h2>
            <p>
              This work considers the whole woman rather than isolating one
              concern while everything else is left untouched. Confidence,
              energy, wellness, identity, personal presence, and lifestyle
              continuously influence one another.
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
          <h2>A framework for creating greater alignment from the inside out.</h2>
          <p>
            Lasting change becomes possible when confidence, wellness,
            identity, and personal presence begin supporting one another
            instead of pulling in different directions.
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
          <h2>Begin with the kind of support this season is asking for.</h2>
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
              You are capable. You have handled complexity, family, work,
              care, leadership, and real responsibility. You are not here
              because you need rescuing or because someone needs to convince
              you of your worth.
            </p>

            <p>
              After years spent adapting to what life required, you may be
              looking for a way back into yourself — a way to feel current,
              settled, alive, and genuinely present in your own life again.
            </p>

            <p>
              You are not looking for a formula or another polished version
              of who you used to be. You are looking for an expression of
              yourself that feels honest for the woman you are now.
            </p>

            <Link className="button button-secondary" to="/experiences">
              Explore Experiences
            </Link>
          </div>

          <div className="home-recognition-visual">
            <img
              src={recognitionImage}
              alt="A Power Within gathering with a facilitator speaking to a group"
            />
          </div>
        </div>
      </section>

      <section className="home-closing">
        <div className="home-closing-inner section-shell">
          <p className="eyebrow">The Invitation</p>

          <h2>
            Let your outer life become a more truthful expression of who you
            are now.
          </h2>

          <p>
            You have spent a long time doing what was responsible, capable,
            and required. This season can be less about maintaining an older
            version of yourself and more about choosing what feels honest,
            current, and fully yours.
          </p>

          <div className="home-closing-actions">
            <Link className="button button-primary" to="/experiences">
              Explore Experiences
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