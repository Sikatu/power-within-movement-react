import { Link } from 'react-router-dom'
import podcastConversationImage from '../assets/images/podcast-reflection-conversation.webp'
import podcastImage from '../assets/images/podcast-vibrations.webp'
import vaultImage from '../assets/images/vault-reflection-journal.webp'
import './Podcast.css'

const podcastLinks = [
  {
    label: 'Apple Podcasts',
    href: 'https://podcasts.apple.com/us/podcast/raising-her-confidence-confidence-wellness-style-personal/id1827158418',
    primary: true,
  },
  {
    label: 'Spotify',
    href: 'https://open.spotify.com/show/4ml9p7e5NLrUVqrd9HxnqT',
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@RaisingHerConfidence',
  },
]

const territories = [
  {
    number: '01',
    eyebrow: 'The Woman Herself',
    title: 'Confidence, identity, and self-trust',
    text:
      'Conversations about recognizing yourself again, navigating transition, rebuilding confidence, and becoming more grounded in the woman you are now.',
  },
  {
    number: '02',
    eyebrow: 'The Way She Shows Up',
    title: 'Personal Presence, color, beauty, and style',
    text:
      'Exploring the visible choices that shape how a woman feels, expresses herself, enters a room, and brings the inside into better conversation with the outside.',
  },
  {
    number: '03',
    eyebrow: 'The Life Around Her',
    title: 'Wellness, motherhood, relationships, and intentional living',
    text:
      'Thoughtful conversations about energy, family, relationships, responsibility, and creating a life that supports the person you are becoming.',
  },
  {
    number: '04',
    eyebrow: 'The Girl Beside Her',
    title: 'Daughters, teen confidence, and meaningful connection',
    text:
      'Language for mothers, mentors, and trusted adults who want to help girls build identity, confidence, belonging, and connection without adding more pressure.',
  },
]

const listeners = [
  {
    title: 'For Women',
    text:
      'For women navigating confidence, identity, visibility, style, wellness, and a season that asks them to know themselves differently.',
  },
  {
    title: 'For Mothers',
    text:
      'For mothers thinking about their own confidence while also shaping the conversations their daughters are growing up inside.',
  },
  {
    title: 'For Mentors + Families',
    text:
      'For trusted adults who want better language for confidence, communication, self-image, belonging, and meaningful connection.',
  },
  {
    title: 'For Professionals',
    text:
      'For beauty, image, wellness, and transformation-centered professionals who understand that how a woman feels and how she shows up belong in the same conversation.',
  },
]

const conversationTopics = [
  'Confidence, identity, and self-trust',
  'Personal Presence, color, style, and beauty',
  'Wellness, energy, and intentional living',
  'Motherhood and family transitions',
  'Daughters, teens, and meaningful connection',
  'Visibility, reinvention, and seasons of change',
]

function Podcast() {
  return (
    <main id="main-content" className="podcast-page">
      <section className="podcast-hero">
        <div className="section-shell podcast-hero-inner">
          <p className="eyebrow">Raising Her Confidence</p>

          <h1>
            Conversations for the woman you are becoming
            <span>and the confidence you are shaping around you.</span>
          </h1>

          <p className="podcast-hero-lead">
            A podcast from Kim Mittelstadt and Power Within Collective
            exploring confidence, identity, wellness, motherhood,
            Personal Presence, and the changing seasons of a woman&apos;s
            life.
          </p>

          <div className="podcast-hero-actions">
            {podcastLinks.map((link) => (
              <a
                className={`button ${
                  link.primary ? 'button-primary' : 'button-secondary'
                }`}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                key={link.label}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="podcast-intro section-shell">
        <div className="podcast-image-frame">
          <span aria-hidden="true" />

          <img
            src={podcastImage}
            alt="Raising Her Confidence podcast artwork"
          />
        </div>

        <div className="podcast-intro-copy">
          <p className="eyebrow">The Podcast</p>

          <h2>
            Confidence is not one conversation.
            It moves through the whole woman.
          </h2>

          <p>
            Raising Her Confidence follows the places confidence
            actually lives: identity, wellness, motherhood,
            relationships, beauty, style, visibility, self-trust,
            and the choices that shape a new chapter.
          </p>

          <p>
            Some episodes begin with the woman herself. Others begin
            with the daughter she is raising, the client she is
            guiding, the body she is learning again, or the life that
            no longer fits in quite the same way.
          </p>

          <p className="podcast-intro-note">
            The thread is the same: helping women recognize what is
            true, name what is changing, and show up with greater
            clarity.
          </p>
        </div>
      </section>

      <section className="podcast-premise">
        <div className="section-shell podcast-premise-inner">
          <p className="eyebrow">The Heart of Raising Her Confidence</p>

          <h2>
            The inner life matters.
            <span>So does the way we live it out loud.</span>
          </h2>

          <p>
            Confidence can be shaped by a conversation, a relationship,
            a season of change, the way we care for ourselves, the way
            we dress, the stories we believe, and the people learning
            from how we move through the world.
          </p>
        </div>
      </section>

      <section className="podcast-territories section-shell">
        <header className="podcast-section-heading">
          <p className="eyebrow">What This Podcast Holds</p>

          <h2>Four places the conversation keeps returning to.</h2>
        </header>

        <div className="podcast-territory-list">
          {territories.map((territory) => (
            <article key={territory.number}>
              <span className="podcast-territory-number">
                {territory.number}
              </span>

              <div>
                <p className="eyebrow">{territory.eyebrow}</p>
                <h3>{territory.title}</h3>
              </div>

              <p className="podcast-territory-copy">
                {territory.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="podcast-trailer">
        <div className="section-shell podcast-trailer-inner">
          <div className="podcast-trailer-copy">
            <p className="eyebrow">Where It Began</p>

            <h2>
              Begin with the invitation that started
              Raising Her Confidence.
            </h2>

            <p>
              The original trailer begins with confidence,
              motherhood, teen self-esteem, and the conversations
              that help girls feel seen and supported. Those roots
              still matter.
            </p>

            <p>
              The show now carries that same intention into a wider
              conversation about women, identity, wellness,
              Personal Presence, and the seasons that shape how we
              see ourselves and one another.
            </p>
          </div>

          <iframe
            title="Raising Her Confidence Spotify trailer"
            src="https://open.spotify.com/embed/episode/6PCrYDrmTQEe0cweohSP9I?utm_source=generator&si=085b4566eba74064"
            width="100%"
            height="280"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      </section>

      <section className="podcast-family section-shell">
        <div className="podcast-family-copy">
          <p className="eyebrow">Confidence Is Relational Too</p>

          <h2>
            Sometimes the conversation is about you.
            Sometimes it is about the girl listening to you.
          </h2>

          <p>
            Raising Her Confidence makes room for both. A woman can
            be finding her own footing while also raising,
            mentoring, loving, or guiding someone who is learning
            how to find hers.
          </p>

          <p>
            Conversations around comparison, beauty pressure,
            communication, belonging, identity, and self-trust
            remain an important part of the show, without asking
            them to carry the entire definition of it.
          </p>

          <Link className="podcast-family-link" to="/teen-programs">
            Explore Teen + Family Support
            <span aria-hidden="true"> &rarr;</span>
          </Link>
        </div>

        <img
          src={podcastConversationImage}
          alt="Mother and daughter in a warm supportive conversation"
          loading="lazy"
          decoding="async"
        />
      </section>

      <section className="podcast-listeners">
        <div className="section-shell">
          <header className="podcast-section-heading">
            <p className="eyebrow">Who It Is For</p>

            <h2>
              Different listeners.
              One shared conversation about confidence.
            </h2>
          </header>

          <div className="podcast-listener-grid">
            {listeners.map((listener, index) => (
              <article key={listener.title}>
                <span>
                  {String(index + 1).padStart(2, '0')}
                </span>

                <h3>{listener.title}</h3>
                <p>{listener.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="podcast-topics section-shell">
        <header className="podcast-section-heading">
          <p className="eyebrow">Conversation Themes</p>

          <h2>
            The subjects change.
            The deeper question is often the same.
          </h2>

          <p>
            What helps a woman feel more grounded in who she is,
            clearer about what matters, and more at home in the way
            she lives and shows up?
          </p>
        </header>

        <div className="podcast-topic-list">
          {conversationTopics.map((topic, index) => (
            <article key={topic}>
              <span>
                {String(index + 1).padStart(2, '0')}
              </span>

              <p>{topic}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="podcast-resources">
        <div className="section-shell podcast-resources-grid">
          <div className="podcast-resources-visual">
            <span aria-hidden="true" />

            <img
              src={vaultImage}
              alt="Reflection journal representing The Vault public resources"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="podcast-resources-copy">
            <p className="eyebrow">Continue With The Vault&trade;</p>

            <h2>
              When an episode opens a question,
              keep following what feels useful.
            </h2>

            <p>
              The Vault&trade; is Power Within Collective&apos;s public
              resource collection: free tools, thoughtful editorial
              guides, reflection, and The Power Within Edit.
            </p>

            <p>
              Come for one useful question. Return when another one
              becomes relevant.
            </p>

            <div className="podcast-resources-actions">
              <Link
                className="button button-primary"
                to="/resources"
              >
                Explore Resources
              </Link>

              <Link
                className="button button-secondary"
                to="/resources#100-conversation-starters"
              >
                100 Conversation Starters
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Podcast