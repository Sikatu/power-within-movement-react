import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import ContactCTA from '../components/ContactCTA'
import podcastImage from '../assets/images/podcast-vibrations.webp'
import teenImage from '../assets/images/podcast-reflection-conversation.webp'
import storyImage from '../assets/images/story.webp'
import vaultImage from '../assets/images/vault.webp'

const spotifyTrailerEmbedUrl = 'https://open.spotify.com/embed/episode/6PCrYDrmTQEe0cweohSP9I?utm_source=generator&si=085b4566eba74064'

const podcastLinks = [
  {
    label: 'Apple Podcasts',
    href: 'https://podcasts.apple.com/us/podcast/raising-her-confidence-build-connection-teen-self-esteem/id1827158418',
  },
  {
    label: 'Spotify',
    href: 'https://open.spotify.com/show/4ml9p7e5NLrUVqrd9HxnqT',
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@PowerWithinCollective',
  },
]

const themes = [
  {
    number: '01',
    title: 'Confidence',
    text: 'Helping girls and women build confidence that is rooted in identity, not approval.',
  },
  {
    number: '02',
    title: 'Connection',
    text: 'Creating better language for mothers, daughters, mentors, and families to talk about what matters.',
  },
  {
    number: '03',
    title: 'Self-Worth',
    text: 'Supporting young women as they navigate pressure, comparison, beauty standards, and belonging.',
  },
]

const listenerCards = [
  {
    title: 'For Moms',
    text:
      'Conversations that help mothers better understand the emotional world their daughters are growing through.',
  },
  {
    title: 'For Mentors',
    text:
      'Encouragement and language for trusted adults who want to guide young women with clarity and care.',
  },
  {
    title: 'For Women',
    text:
      'Reflections on confidence, identity, beauty, presence, and the work of returning to yourself.',
  },
  {
    title: 'For Professionals',
    text:
      'Perspective for those who support clients, families, teens, and women in transformation-centered work.',
  },
]

const conversationTopics = [
  'Teen self-esteem and confidence',
  'Mother-daughter communication',
  'Identity, values, and voice',
  'Body image and beauty pressure',
  'Friendship, belonging, and comparison',
  'Confidence through seasons of change',
]

function Podcast() {
  return (
    <main>
      <PageHero
        eyebrow="Raising Her Confidence"
        title="Conversations for confidence, connection, and the girls we are helping grow."
        text="A podcast from Kim Mittelstadt and Power Within Collective for mothers, mentors, and women who care deeply about confidence, identity, communication, and self-worth."
      />

      <section className="section story-section pwc-podcast-story-section">
        <div className="story-grid pwc-podcast-story-grid">
          <figure className="story-image pwc-podcast-hero-image">
            <img loading="lazy" src={podcastImage} alt="Raising Her Confidence podcast artwork" />
          </figure>

          <div className="story-copy pwc-podcast-story-copy">
            <p className="eyebrow">The Podcast</p>
            <h2>Raising confidence starts with the conversations we are willing to have.</h2>
            <p>
              Raising Her Confidence supports mothers, mentors, and women who want to help girls
              grow with stronger self-worth, clearer identity, healthier communication, and deeper confidence.
            </p>
            <p>
              Each conversation is part of the larger Power Within movement: helping women and girls feel seen,
              understood, supported, and more connected to who they are becoming.
            </p>

            <div className="pwc-podcast-actions">
              {podcastLinks.map((link) => (
                <a
                  className={link.label === 'Apple Podcasts' ? 'btn primary' : 'btn ghost'}
                  href={link.href}
                  key={link.label}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section pwc-podcast-trailer-section">
        <div className="pwc-podcast-trailer-card">
          <div className="pwc-podcast-trailer-copy">
            <p className="eyebrow">Listen First</p>
            <h2>Begin with Kim’s invitation into Raising Her Confidence.</h2>
            <p>
              The trailer gives visitors the heart behind the podcast: confidence, connection,
              motherhood, teen self-esteem, and the conversations that help girls feel seen and supported.
            </p>
          </div>

          <div className="pwc-podcast-spotify-frame">
            <iframe
              title="Raising Her Confidence Spotify trailer"
              src={spotifyTrailerEmbedUrl}
              width="100%"
              height="352"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            ></iframe>
          </div>
        </div>
      </section>
      <section className="section pwc-podcast-themes-section">
        <div className="section-header">
          <p className="eyebrow">What This Podcast Holds</p>
          <h2>Not quick advice. Grounded conversations for the real work of confidence.</h2>
        </div>

        <div className="cards pwc-podcast-themes-grid">
          {themes.map((theme) => (
            <article className="card pwc-podcast-theme-card" key={theme.title}>
              <span>{theme.number}</span>
              <h3>{theme.title}</h3>
              <p>{theme.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section pwc-podcast-editorial-section">
        <div className="pwc-podcast-editorial-card">
          <div className="pwc-podcast-editorial-copy">
            <p className="eyebrow">For the Adults Walking Beside Her</p>
            <h2>Sometimes the right conversation becomes the support she remembers.</h2>
            <p>
              The podcast gives language to the things girls and women are already carrying:
              comparison, confidence, communication, identity, beauty pressure, self-trust,
              and the need to feel deeply known.
            </p>
            <p>
              It is a companion to the Teen Programs, The Vault, and the larger Power Within Collective ecosystem.
            </p>
          </div>

          <figure className="pwc-podcast-editorial-image">
            <img loading="lazy" src={teenImage} alt="Mother and daughter in a warm supportive conversation" />
          </figure>
        </div>
      </section>

      <section className="section pwc-podcast-listeners-section">
        <div className="section-header">
          <p className="eyebrow">Who It Supports</p>
          <h2>For the women, mothers, and mentors shaping confidence in real life.</h2>
        </div>

        <div className="pwc-podcast-listeners-grid">
          {listenerCards.map((card) => (
            <article className="pwc-podcast-listener-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section pwc-podcast-topics-section">
        <div className="section-header">
          <p className="eyebrow">Conversation Themes</p>
          <h2>Language for what girls, mothers, mentors, and women are already navigating.</h2>
        </div>

        <div className="pwc-podcast-topic-board">
          {conversationTopics.map((topic) => (
            <article className="pwc-podcast-topic-item" key={topic}>
              <span aria-hidden="true"></span>
              <p>{topic}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section pwc-podcast-vault-section">
        <div className="pwc-podcast-vault-card">
          <figure>
            <img loading="lazy" src={vaultImage} alt="Reflection tools and conversation resources" />
          </figure>

          <div>
            <p className="eyebrow">Continue the Conversation</p>
            <h2>Pair the podcast with reflection tools from The Vault.</h2>
            <p>
              The Vault gives families, mentors, and women simple prompts and conversation starters
              to keep meaningful conversations moving after an episode ends.
            </p>
            <Link className="btn ghost" to="/resources">
              Open The Vault
            </Link>
          </div>
        </div>
      </section>

      <section className="section pwc-podcast-closing-section">
        <div className="pwc-podcast-closing-card">
          <div>
            <p className="eyebrow">Part of the Movement</p>
            <h2>Raising her confidence begins with how we listen, speak, and walk beside her.</h2>
            <p>
              This podcast is one doorway into the larger Power Within Collective ecosystem:
              resources, programs, experiences, and conversations designed to support confidence from the inside out.
            </p>
          </div>

          <figure>
            <img loading="lazy" src={storyImage} alt="Women gathered in meaningful conversation" />
          </figure>
        </div>
      </section>

      <ContactCTA
        eyebrow="Raising Her Confidence"
        title="Want support beyond the podcast?"
        text="Explore teen programs, reflection resources, or a clarity conversation to find the next doorway that fits your family, group, or season."
        actions={[
          { label: 'Explore Teen Programs', to: '/teen-programs', variant: 'primary' },
          { label: 'Open The Vault', to: '/resources', variant: 'secondary' },
        ]}
      />
    </main>
  )
}

export default Podcast