import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import vaultImage from '../assets/images/vault-reflection-journal.webp'
import conversationStartersImage from '../assets/images/100-conversation-starters.webp'

const vaultAccessPath = '/contact'
const resourceAnchorPath = '/resources#100-conversation-starters'
const conversationStartersDownloadPath = '/contact?resource=100-conversation-starters'

const vaultContents = [
  {
    title: 'Confidence and personal presence resources',
    text: 'Tools for understanding and inhabiting the kind of presence that does not require performance.',
  },
  {
    title: 'Wellness and intentional living guidance',
    text: 'Practical support for the physical and daily foundations that make everything else possible.',
  },
  {
    title: 'Style, image, and color education',
    text: 'Honest, intelligent tools for external expression that reflects an internal truth.',
  },
  {
    title: 'Reflection tools for clarity and self-leadership',
    text: 'Frameworks and prompts that give a more precise language for what you are actually experiencing.',
  },
  {
    title: 'Ongoing workshops, teachings, and audio sessions',
    text: 'Depth delivered in formats that fit into a real life.',
  },
  {
    title: 'Seasonal resources designed for continued growth',
    text: 'Because who you are in this chapter is not who you will be in the next.',
  },
]

const downloadableResources = [
  {
    category: 'Vault Preview',
    title: '100 Conversation Starters',
    description:
      'A curated preview of The Vault™ created to open warmer conversations, clearer reflection, and more honest self-recognition.',
    note: 'For women, families, facilitators, and communities who want connection to feel thoughtful instead of forced.',
    image: conversationStartersImage,
    href: conversationStartersDownloadPath,
    cta: 'Request the Download',
  },
]

const longReturnPoints = [
  'Curated resources and teachings updated regularly so what you find here stays current with where women actually are.',
  'Ongoing workshops, audio sessions, and guided support that go further than surface-level inspiration.',
  'A private, intentional environment free from the noise of social media and the pressure to perform.',
  'Content designed to support continued confidence, clarity, and personal evolution, not just a single breakthrough.',
]

function Resources() {
  return (
    <main>
      <PageHero
        eyebrow="Resources"
        title="Not more information. A more intentional place to return to yourself."
        text="The Vault™ is a curated resource environment for women who want substance, reflection, and practical support for the long return."
      />

      <section className="section vault-intro-section">
        <div className="vault-intro-grid">
          <div className="vault-image-panel">
            <img loading="lazy" src={vaultImage} alt="The Vault resource environment" />
          </div>

          <div className="vault-copy-panel">
            <p className="eyebrow">The Vault™</p>
            <h2>Most women are not struggling because they lack information.</h2>
            <p>
              They are struggling because the information they have has not been given
              the space to become something real.
            </p>
            <p>
              The Vault™ is a curated resource environment built for women who are ready
              to go deeper, past the inspiration that evaporates, past the advice that
              does not account for a life as complex as theirs, into the kind of thinking
              and tools that actually hold.
            </p>
            <p>
              This is not a content library. It is a place to return to, consistently,
              intentionally, and at whatever pace your season allows.
            </p>

            <div className="hero-actions">
              <Link to={vaultAccessPath} className="btn primary">Enter the Vault</Link>
              <Link to={resourceAnchorPath} className="btn secondary">Free Resources</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section vault-inside-section">
        <div className="vault-section-header">
          <p className="eyebrow">Inside the Vault™</p>
          <h2>Everything here is chosen with one question in mind.</h2>
          <p>
            Does this help a woman become more herself, or does it ask her to perform
            a version of herself?
          </p>
        </div>

        <div className="vault-content-grid">
          {vaultContents.map((item, index) => (
            <article className="vault-content-card" key={item.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section vault-preview-section" id="100-conversation-starters">
        {downloadableResources.map((resource) => (
          <article className="vault-preview-card vault-resource-card" key={resource.title}>
            <div className="vault-resource-image">
              <img loading="lazy" src={resource.image} alt={`${resource.title} resource preview`} />
            </div>

            <div className="vault-resource-copy">
              <p className="eyebrow">{resource.category}</p>
              <h2>{resource.title}</h2>
              <p>{resource.description}</p>
              <p className="vault-resource-note">{resource.note}</p>

              <div className="hero-actions vault-resource-actions">
                <Link to={resource.href} className="btn primary">{resource.cta}</Link>
                <Link to={vaultAccessPath} className="btn secondary">Ask About The Vault™</Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="section vault-long-return-section">
        <div className="vault-long-return-grid">
          <div>
            <p className="eyebrow">Designed for the Long Return</p>
            <h2>Real transformation is not an event. It is a direction.</h2>
            <p>
              It is one you orient toward again and again, in different seasons, with
              different questions. The Vault™ is built to meet you there.
            </p>
          </div>

          <div className="vault-list-card">
            <ul>
              {longReturnPoints.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="section vault-why-section">
        <div className="vault-why-card">
          <p className="eyebrow">Why the Vault Exists</p>
          <h2>The personal development world has given women more content than they can consume and less substance than they need.</h2>
          <p>
            Most of it speaks to the beginning of a journey, the awakening, the pivot,
            the fresh start. Very little of it is built for the woman who has already
            done significant work on herself and is navigating something more complex:
            how to continue becoming more herself without discarding what she has already built.
          </p>
          <p>
            The Vault™ was created to fill that gap. It is not a collection of quick
            answers. It is a curated space for women who think carefully, live fully,
            and are ready for resources that treat them accordingly, with depth, with
            dignity, and with the understanding that their lives are not problems to be
            solved, but seasons to be inhabited with increasing intention.
          </p>
          <p>
            A space designed to support the way you think, live, lead, and show up.
            Not who you were. Who you are becoming.
          </p>

          <div className="hero-actions">
            <Link to={vaultAccessPath} className="btn primary">Enter the Vault</Link>
            <Link to={resourceAnchorPath} className="btn secondary">Free Resources</Link>
          </div>
        </div>
      </section>
    
      {/* seo-phase-3a-resource-articles-start */}
      <section className="resource-article-cluster-v1">
        <div className="resource-article-cluster-copy-v1">
          <p className="eyebrow">Guides & Reflections</p>
          <h2>Thoughtful resources for confidence, color, style, and presence.</h2>
          <p>
            Begin with these foundational guides, then move toward the private experience
            that fits the season you are in.
          </p>
        </div>

        <div className="resource-article-card-grid-v1">
          <a href="/resources/what-is-color-analysis">
            <span>Color Analysis Guide</span>
            <strong>What Is Color Analysis?</strong>
            <p>Understand how color supports wardrobe, makeup, hair direction, and confidence.</p>
          </a>

          <a href="/resources/what-is-personal-style-analysis">
            <span>Style Analysis Guide</span>
            <strong>What Is Personal Style Analysis?</strong>
            <p>Learn how style direction clarifies wardrobe, proportion, and personal presence.</p>
          </a>

          <a href="/resources/fashion-advice-for-women-over-40">
            <span>Style & Confidence</span>
            <strong>Fashion Advice for Women Over 40</strong>
            <p>Move beyond rules and dress for identity, ease, and the woman you are becoming.</p>
          </a>

          <a href="/resources/rebuild-confidence-through-personal-style">
            <span>Confidence & Style</span>
            <strong>How to Rebuild Confidence Through Personal Style</strong>
            <p>See how style can support alignment, recognition, and renewed self-trust.</p>
          </a>

          <a href="/resources/confidence-coaching-for-women">
            <span>Confidence Coaching</span>
            <strong>Confidence Coaching for Women in a New Season of Life</strong>
            <p>Explore confidence as identity, presence, self-trust, and whole-person alignment.</p>
          </a>
        </div>
      </section>
      {/* seo-phase-3a-resource-articles-end */}
</main>
  )
}

export default Resources

