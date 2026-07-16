import { Link } from 'react-router-dom'
import teenImage from '../assets/images/teen-confidence-conversation.webp'
import './TeenPrograms.css'

const trustItems = [
  { label: 'Identity', value: 'Rooted' },
  { label: 'Connection', value: 'Warmer' },
  { label: 'Confidence', value: 'Steadier' },
]

const focusCards = [
  { number: '01', title: 'Self-Image & Body Confidence', text: 'Helping her build a healthier relationship with her body, image, appearance, and expression.' },
  { number: '02', title: 'Identity & Self-Trust', text: 'Giving her language for who she is, what matters to her, and how she wants to show up.' },
  { number: '03', title: 'Mother-Daughter Connection', text: 'Creating warmer conversations that reduce pressure and build trust between generations.' },
  { number: '04', title: 'Presence, Style & Expression', text: 'Helping her use beauty and style as healthy self-expression, not performance or comparison.' },
]

const pathways = [
  { number: '01', title: 'Teen Confidence Support', text: 'For teen girls who need steadier language, confidence support, and a place to be seen clearly.', action: 'Start a conversation', to: '/contact?interest=teen' },
  { number: '02', title: 'Mother-Daughter Conversations', text: 'For mothers who want warmer, braver conversations without adding pressure or shame.', action: 'Explore the resource', to: '/resources#100-conversation-starters' },
  { number: '03', title: 'Raising Her Confidence Podcast', text: 'For ongoing conversations around confidence, connection, teen self-esteem, and identity.', action: 'Listen to the podcast', to: '/podcast' },
]

function TeenPrograms() {
  return (
    <main id="main-content" className="teen-page">
      <section className="teen-hero section-shell">
        <p className="eyebrow">Teen Programs</p>
        <h1>Teen Confidence Programs for Girls Becoming Themselves</h1>
        <p>Support for teen girls, mothers, mentors, and families who want deeper conversations around identity, confidence, self-image, connection, and presence.</p>
      </section>

      <section className="teen-intro section-shell">
        <div className="teen-image-frame">
          <span aria-hidden="true" />
          <img src={teenImage} alt="Teen confidence and mother daughter connection" />
        </div>
        <div>
          <p className="eyebrow">For the Girl Becoming</p>
          <h2>She does not need more pressure. She needs steadier places to become herself.</h2>
          <p>The teen years can be full of comparison, performance, changing bodies, shifting friendships, social pressure, and questions she may not yet have words for.</p>
          <p>These programs are designed to help girls build confidence from the inside out, while helping mothers and mentors create better conversations around identity, beauty, wellness, style, and self-trust.</p>
          <div className="teen-trust-grid">
            {trustItems.map((item) => (
              <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong></article>
            ))}
          </div>
        </div>
      </section>

      <section className="teen-belief section-shell">
        <blockquote>
          <p className="eyebrow">The Heart of the Work</p>
          <h2>Confidence is not taught by telling her to be confident.</h2>
          <p>Confidence is shaped through language, safety, self-recognition, embodiment, and the experience of being seen without being fixed. This work helps girls understand who they are, not just how they are being perceived.</p>
        </blockquote>
      </section>

      <section className="teen-focus section-shell">
        <header className="teen-section-heading">
          <p className="eyebrow">What We Support</p>
          <h2>Grounded conversations for the moments that matter.</h2>
          <p>The work blends identity, emotional steadiness, self-image, beauty, wellness, style, and mother-daughter connection into one supportive experience.</p>
        </header>
        <div>
          {focusCards.map((card) => (
            <article key={card.title}>
              <span>{card.number}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="teen-pathways section-shell">
        <header className="teen-section-heading">
          <p className="eyebrow">Ways to Begin</p>
          <h2>Choose the doorway that fits this season.</h2>
          <p>Start with a conversation, listen to the podcast, or explore a resource that opens the door to more honest connection.</p>
        </header>
        <div>
          {pathways.map((pathway) => (
            <Link to={pathway.to} key={pathway.title}>
              <span>{pathway.number}</span>
              <h3>{pathway.title}</h3>
              <p>{pathway.text}</p>
              <strong>{pathway.action} <span aria-hidden="true">→</span></strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="teen-mentors section-shell">
        <p className="eyebrow">For Mothers and Mentors</p>
        <h2>You do not have to have every answer. You can begin with better questions.</h2>
        <p>Sometimes the most meaningful shift begins with one conversation where she feels heard instead of corrected, supported instead of managed, and guided without being pushed.</p>
      </section>

      <section className="teen-closing section-shell">
        <p className="eyebrow">Begin Gently</p>
        <h2>Support her confidence with steadier conversations.</h2>
        <p>Reach out to begin a conversation about teen confidence, mother-daughter connection, resources, or the next right support.</p>
        <div>
          <Link className="button button-primary" to="/contact?interest=teen">Ask About Teen Support</Link>
          <Link className="button button-secondary" to="/podcast">Listen to the Podcast</Link>
        </div>
      </section>
    </main>
  )
}

export default TeenPrograms
