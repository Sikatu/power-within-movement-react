import { Link } from 'react-router-dom'
import teenImage from '../assets/images/teen-confidence-conversation.webp'
import conversationImage from '../assets/images/podcast-reflection-conversation.webp'
import './TeenPrograms.css'

const trustItems = [
  { label: 'Identity', value: 'Rooted' },
  { label: 'Connection', value: 'Warmer' },
  { label: 'Confidence', value: 'Steadier' },
]

const supportAreas = [
  {
    number: '01',
    eyebrow: 'Self-Image + Body Confidence',
    title: 'A kinder relationship with the person in the mirror.',
    text:
      'Helping her build a healthier relationship with her body, image, appearance, and expression without asking her to perform confidence she does not yet feel.',
  },
  {
    number: '02',
    eyebrow: 'Identity + Self-Trust',
    title: 'Language for who she is becoming.',
    text:
      'Giving her space to recognize what matters to her, trust her own voice, and understand how she wants to move through friendships, pressure, visibility, and change.',
  },
  {
    number: '03',
    eyebrow: 'Mother-Daughter Connection',
    title: 'Better conversations without more pressure.',
    text:
      'Creating warmer conversations that reduce correction, defensiveness, and shame while building greater trust between generations.',
  },
  {
    number: '04',
    eyebrow: 'Presence, Style + Expression',
    title: 'Expression that feels like herself.',
    text:
      'Helping her understand beauty, clothing, style, and presence as forms of healthy self-expression rather than performance, comparison, or fitting in.',
  },
]

const pathways = [
  {
    number: '01',
    title: 'Teen + Family Support',
    text:
      'For teen girls, mothers, and families who want steadier language, confidence support, and a thoughtful place to begin.',
    action: 'Start a conversation',
    to: '/contact?interest=teens',
  },
  {
    number: '02',
    title: '100 Conversation Starters',
    text:
      'For families who want a simple way to open better questions, reflection, curiosity, and meaningful connection.',
    action: 'Explore the free resource',
    to: '/resources#100-conversation-starters',
  },
  {
    number: '03',
    title: 'Raising Her Confidence',
    text:
      'For ongoing conversations about confidence, identity, motherhood, daughters, connection, wellness, and the seasons shaping women and girls.',
    action: 'Listen to the podcast',
    to: '/podcast',
  },
]

function TeenPrograms() {
  return (
    <main id="main-content" className="teen-page">
      <section className="teen-hero">
        <div className="section-shell teen-hero-grid">
          <div className="teen-hero-copy">
            <p className="eyebrow">Teen + Family</p>

            <h1>
              Confidence grows where she feels
              <span>seen, heard, and free to become herself.</span>
            </h1>

            <p className="teen-hero-lead">
              Thoughtful support for teen girls, mothers, mentors, and
              families navigating identity, confidence, self-image,
              connection, expression, and the conversations that shape
              a young woman&apos;s sense of self.
            </p>

            <div className="teen-hero-actions">
              <Link
                className="button button-primary"
                to="/contact?interest=teens"
              >
                Ask About Teen + Family Support
              </Link>

              <Link
                className="button button-secondary"
                to="/podcast"
              >
                Listen to Raising Her Confidence
              </Link>
            </div>
          </div>

          <div className="teen-hero-visual">
            <span aria-hidden="true" />

            <img
              src={teenImage}
              alt="Teen confidence and mother daughter connection"
            />
          </div>
        </div>
      </section>

      <section className="teen-signals">
        <div className="section-shell teen-signals-grid">
          {trustItems.map((item, index) => (
            <article key={item.label}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="teen-intro section-shell">
        <div>
          <p className="eyebrow">For the Girl Becoming</p>

          <h2>
            She does not need more pressure.
            She needs steadier places to become herself.
          </h2>
        </div>

        <div className="teen-intro-copy">
          <p>
            The teen years can be full of comparison, performance,
            changing bodies, shifting friendships, social pressure,
            and questions she may not yet have words for.
          </p>

          <p>
            This work helps girls build confidence from the inside out
            while helping mothers and trusted adults create better
            conversations around identity, beauty, wellness, style,
            belonging, and self-trust.
          </p>
        </div>
      </section>

      <section className="teen-belief">
        <div className="section-shell teen-belief-inner">
          <p className="eyebrow">The Heart of the Work</p>

          <h2>
            Confidence is not taught by telling her
            <span>to be confident.</span>
          </h2>

          <p>
            Confidence is shaped through language, safety,
            self-recognition, embodiment, and the experience of being
            seen without being fixed.
          </p>

          <p>
            The goal is not to teach a girl how to perform certainty.
            It is to help her understand who she is, trust what she
            knows about herself, and build a steadier relationship with
            her own voice.
          </p>
        </div>
      </section>

      <section className="teen-focus section-shell">
        <header className="teen-section-heading">
          <p className="eyebrow">What We Support</p>

          <h2>
            Grounded conversations for the moments that matter.
          </h2>

          <p>
            Identity, self-image, connection, and expression are not
            separate conversations. They often shape one another.
          </p>
        </header>

        <div className="teen-focus-list">
          {supportAreas.map((area) => (
            <article key={area.number}>
              <span>{area.number}</span>

              <div>
                <p className="eyebrow">{area.eyebrow}</p>
                <h3>{area.title}</h3>
              </div>

              <p className="teen-focus-copy">{area.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="teen-connection">
        <div className="section-shell teen-connection-grid">
          <div className="teen-connection-copy">
            <p className="eyebrow">For Mothers + Mentors</p>

            <h2>
              You do not have to have every answer.
              You can begin with better questions.
            </h2>

            <p>
              Sometimes the most meaningful shift begins with one
              conversation where she feels heard instead of corrected,
              supported instead of managed, and guided without being
              pushed.
            </p>

            <p>
              The adults around her do not need perfect language.
              They need curiosity, steadiness, and enough room to let
              the conversation become more honest.
            </p>

            <Link
              className="teen-connection-link"
              to="/resources#100-conversation-starters"
            >
              Explore 100 Conversation Starters
              <span aria-hidden="true"> &rarr;</span>
            </Link>
          </div>

          <img
            src={conversationImage}
            alt="Mother and daughter in a warm supportive conversation"
            loading="lazy"
            decoding="async"
          />
        </div>
      </section>

      <section className="teen-pathways section-shell">
        <header className="teen-section-heading">
          <p className="eyebrow">Ways to Begin</p>

          <h2>
            Choose the doorway that fits this season.
          </h2>

          <p>
            Begin with personal support, a useful resource, or an
            ongoing conversation you can return to.
          </p>
        </header>

        <div className="teen-pathway-list">
          {pathways.map((pathway) => (
            <Link to={pathway.to} key={pathway.title}>
              <span>{pathway.number}</span>

              <div>
                <h3>{pathway.title}</h3>
                <p>{pathway.text}</p>
              </div>

              <strong>
                {pathway.action}
                <span aria-hidden="true"> &rarr;</span>
              </strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="teen-closing">
        <div className="section-shell teen-closing-inner">
          <p className="eyebrow">Begin Gently</p>

          <h2>
            Support her confidence with steadier conversations.
          </h2>

          <p>
            Reach out when you want to talk through teen confidence,
            mother-daughter connection, family resources, or the next
            right kind of support.
          </p>

          <div className="teen-closing-actions">
            <Link
              className="button button-primary"
              to="/contact?interest=teens"
            >
              Ask About Teen + Family Support
            </Link>

            <Link
              className="button button-secondary"
              to="/podcast"
            >
              Listen to Raising Her Confidence
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default TeenPrograms