import { Link } from 'react-router-dom'
import conversationStartersImage from '../assets/images/100-conversation-starters.webp'
import vaultImage from '../assets/images/vault-reflection-journal.webp'
import { resourceArticleSummaries } from '../data/resourceArticles.js'
import './Resources.css'

const vaultContents = [
  { number: '01', title: 'Confidence and personal presence resources', text: 'Tools for understanding and inhabiting the kind of presence that does not require performance.' },
  { number: '02', title: 'Wellness and intentional living guidance', text: 'Practical support for the physical and daily foundations that make everything else possible.' },
  { number: '03', title: 'Style, image, and color education', text: 'Honest, intelligent tools for external expression that reflects an internal truth.' },
  { number: '04', title: 'Reflection tools for clarity and self-leadership', text: 'Frameworks and prompts that give a more precise language for what you are actually experiencing.' },
  { number: '05', title: 'Ongoing workshops, teachings, and audio sessions', text: 'Depth delivered in formats that fit into a real life.' },
  { number: '06', title: 'Seasonal resources designed for continued growth', text: 'Because who you are in this chapter is not who you will be in the next.' },
]

const longReturnPoints = [
  'Curated resources and teachings updated regularly so what you find here stays current with where women actually are.',
  'Ongoing workshops, audio sessions, and guided support that go further than surface-level inspiration.',
  'A private, intentional environment free from the noise of social media and the pressure to perform.',
  'Content designed to support continued confidence, clarity, and personal evolution, not just a single breakthrough.',
]

function Resources() {
  return (
    <main id="main-content" className="vault-page">
      <section className="vault-hero section-shell">
        <p className="eyebrow">Resources</p>
        <h1><span>Not more information. </span>A more intentional place to return to yourself.</h1>
        <p>The Vault™ is a curated resource environment for women who want substance, reflection, and practical support for the long return.</p>
        <div className="vault-mobile-actions">
          <Link className="button button-primary" to="/contact">Enter the Vault</Link>
          <a className="button button-secondary" href="#100-conversation-starters">Free Resources</a>
        </div>
      </section>

      <section className="vault-intro section-shell">
        <div className="vault-image-frame">
          <span aria-hidden="true" />
          <img src={vaultImage} alt="The Vault resource environment" />
        </div>
        <div className="vault-intro-copy">
          <p className="eyebrow">The Vault™</p>
          <h2>Most women are not struggling because they lack information.</h2>
          <p>They are struggling because the information they have has not been given the space to become something real.</p>
          <p>The Vault™ is a curated resource environment built for women who are ready to go deeper, past the inspiration that evaporates, past the advice that does not account for a life as complex as theirs, into the kind of thinking and tools that actually hold.</p>
          <p>This is not a content library. It is a place to return to, consistently, intentionally, and at whatever pace your season allows.</p>
          <div>
            <Link className="button button-primary" to="/contact">Enter the Vault</Link>
            <a className="button button-secondary" href="#100-conversation-starters">Free Resources</a>
          </div>
        </div>
      </section>

      <section className="vault-inside section-shell">
        <header className="vault-section-heading">
          <p className="eyebrow">Inside the Vault™</p>
          <h2>Everything here is chosen with one question in mind.</h2>
          <p>Does this help a woman become more herself, or does it ask her to perform a version of herself?</p>
        </header>
        <div className="vault-content-grid">
          {vaultContents.map((item) => (
            <article key={item.title}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="100-conversation-starters" className="vault-preview section-shell scroll-target">
        <article>
          <img src={conversationStartersImage} alt="100 Conversation Starters resource preview" />
          <div>
            <p className="eyebrow">Vault Preview</p>
            <h2>100 Conversation Starters</h2>
            <p>A curated preview of The Vault™ created to open warmer conversations, clearer reflection, and more honest self-recognition.</p>
            <p>For women, families, facilitators, and communities who want connection to feel thoughtful instead of forced.</p>
            <div>
              <Link className="button vault-gold-button" to="/contact?resource=100-conversation-starters">Request the Download</Link>
              <Link className="button vault-dark-outline" to="/contact">Ask About The Vault™</Link>
            </div>
          </div>
        </article>
      </section>

      <section className="vault-long-return section-shell">
        <div>
          <p className="eyebrow">Designed for the Long Return</p>
          <h2>Real transformation is not an event. It is a direction.</h2>
          <p>It is one you orient toward again and again, in different seasons, with different questions. The Vault™ is built to meet you there.</p>
        </div>
        <aside>
          <ul>
            {longReturnPoints.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </aside>
      </section>

      <section className="vault-why section-shell">
        <p className="eyebrow">Why the Vault Exists</p>
        <h2>The personal development world has given women more content than they can consume and less substance than they need.</h2>
        <p>Most of it speaks to the beginning of a journey, the awakening, the pivot, the fresh start. Very little of it is built for the woman who has already done significant work on herself and is navigating something more complex: how to continue becoming more herself without discarding what she has already built.</p>
        <p>The Vault™ was created to fill that gap. A space designed to support the way you think, live, lead, and show up. Not who you were. Who you are becoming.</p>
        <div>
          <Link className="button button-primary" to="/contact">Enter the Vault</Link>
          <a className="button button-secondary" href="#100-conversation-starters">Free Resources</a>
        </div>
      </section>

      <section className="vault-guides section-shell">
        <header className="vault-section-heading">
          <p className="eyebrow">Guides &amp; Reflections</p>
          <h2>Thoughtful resources for confidence, color, style, and presence.</h2>
          <p>Begin with these foundational guides, then move toward the private experience that fits the season you are in.</p>
        </header>
        <div className="vault-guide-grid">
          {resourceArticleSummaries.map((article) => (
            <Link to={`/resources/${article.slug}`} key={article.slug}>
              <span>{article.category}</span>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
              <strong>Read the Guide <span aria-hidden="true">→</span></strong>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}

export default Resources
