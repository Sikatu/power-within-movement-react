import { Link } from 'react-router-dom'
import podcastConversationImage from '../assets/images/podcast-reflection-conversation.webp'
import podcastImage from '../assets/images/podcast-vibrations.webp'
import vaultImage from '../assets/images/vault.webp'
import './Podcast.css'

const podcastLinks = [
  { label: 'Apple Podcasts', href: 'https://podcasts.apple.com/us/podcast/raising-her-confidence-build-connection-teen-self-esteem/id1827158418', primary: true },
  { label: 'Spotify', href: 'https://open.spotify.com/show/4ml9p7e5NLrUVqrd9HxnqT' },
  { label: 'YouTube', href: 'https://www.youtube.com/@PowerWithinCollective' },
]

const themes = [
  { number: '01', title: 'Confidence', text: 'Helping girls and women build confidence that is rooted in identity, not approval.' },
  { number: '02', title: 'Connection', text: 'Creating better language for mothers, daughters, mentors, and families to talk about what matters.' },
  { number: '03', title: 'Self-Worth', text: 'Supporting young women as they navigate pressure, comparison, beauty standards, and belonging.' },
]

const listeners = [
  { title: 'For Moms', text: 'Conversations that help mothers better understand the emotional world their daughters are growing through.' },
  { title: 'For Mentors', text: 'Encouragement and language for trusted adults who want to guide young women with clarity and care.' },
  { title: 'For Women', text: 'Reflections on confidence, identity, beauty, presence, and the work of returning to yourself.' },
  { title: 'For Professionals', text: 'Perspective for those who support clients, families, teens, and women in transformation-centered work.' },
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
    <main id="main-content" className="podcast-page">
      <section className="podcast-hero section-shell">
        <p className="eyebrow">Raising Her Confidence</p>
        <h1>Conversations for confidence, connection, and the girls we are helping grow.</h1>
        <p>A podcast from Kim Mittelstadt and Power Within Collective for mothers, mentors, and women who care deeply about confidence, identity, communication, and self-worth.</p>
      </section>

      <section className="podcast-intro section-shell">
        <div className="podcast-image-frame">
          <span aria-hidden="true" />
          <img src={podcastImage} alt="Raising Her Confidence podcast artwork" />
        </div>
        <div>
          <p className="eyebrow">The Podcast</p>
          <h2>Raising confidence starts with the conversations we are willing to have.</h2>
          <p>Raising Her Confidence supports mothers, mentors, and women who want to help girls grow with stronger self-worth, clearer identity, healthier communication, and deeper confidence.</p>
          <p>Each conversation is part of the larger Power Within movement: helping women and girls feel seen, understood, supported, and more connected to who they are becoming.</p>
          <div className="podcast-platform-links">
            {podcastLinks.map((link) => (
              <a className={`button ${link.primary ? 'button-primary' : 'button-secondary'}`} href={link.href} target="_blank" rel="noreferrer" key={link.label}>{link.label}</a>
            ))}
          </div>
        </div>
      </section>

      <section className="podcast-trailer section-shell">
        <article>
          <div>
            <p className="eyebrow">Listen First</p>
            <h2>Begin with Kim’s invitation into Raising Her Confidence.</h2>
            <p>The trailer gives visitors the heart behind the podcast: confidence, connection, motherhood, teen self-esteem, and the conversations that help girls feel seen and supported.</p>
          </div>
          <iframe
            title="Raising Her Confidence Spotify trailer"
            src="https://open.spotify.com/embed/episode/6PCrYDrmTQEe0cweohSP9I?utm_source=generator&si=085b4566eba74064"
            width="100%"
            height="280"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </article>
      </section>

      <section className="podcast-themes section-shell">
        <header className="podcast-section-heading">
          <p className="eyebrow">What This Podcast Holds</p>
          <h2>Not quick advice. Grounded conversations for the real work of confidence.</h2>
        </header>
        <div>
          {themes.map((theme) => (
            <article key={theme.title}>
              <span>{theme.number}</span>
              <h3>{theme.title}</h3>
              <p>{theme.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="podcast-conversation section-shell">
        <div>
          <p className="eyebrow">For the Adults Walking Beside Her</p>
          <h2>Sometimes the right conversation becomes the support she remembers.</h2>
          <p>The podcast gives language to the things girls and women are already carrying: comparison, confidence, communication, identity, beauty pressure, self-trust, and the need to feel deeply known.</p>
          <p>It is a companion to the Teen Programs, The Vault, and the larger Power Within Collective ecosystem.</p>
        </div>
        <img src={podcastConversationImage} alt="Mother and daughter in a warm supportive conversation" />
      </section>

      <section className="podcast-listeners section-shell">
        <header className="podcast-section-heading">
          <p className="eyebrow">Who It Supports</p>
          <h2>For the women, mothers, and mentors shaping confidence in real life.</h2>
        </header>
        <div>
          {listeners.map((listener) => (
            <article key={listener.title}>
              <h3>{listener.title}</h3>
              <p>{listener.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="podcast-topics section-shell">
        <header className="podcast-section-heading">
          <p className="eyebrow">Conversation Themes</p>
          <h2>Language for what girls, mothers, mentors, and women are already navigating.</h2>
        </header>
        <div>
          {conversationTopics.map((topic) => (
            <article key={topic}><span aria-hidden="true" /><p>{topic}</p></article>
          ))}
        </div>
      </section>

      <section className="podcast-vault section-shell">
        <article>
          <img src={vaultImage} alt="Reflection tools and conversation resources" />
          <div>
            <p className="eyebrow">Continue the Conversation</p>
            <h2>Pair the podcast with reflection tools from The Vault.</h2>
            <p>The Vault gives families, mentors, and women simple prompts and conversation starters to keep meaningful conversations moving after an episode ends.</p>
            <div>
              <Link className="button button-primary" to="/teen-programs">Explore Teen Programs</Link>
              <Link className="button button-secondary" to="/resources">Open The Vault</Link>
            </div>
          </div>
        </article>
      </section>
    </main>
  )
}

export default Podcast
