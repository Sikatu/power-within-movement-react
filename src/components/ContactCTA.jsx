import { Link } from 'react-router-dom'

const defaultActions = [
  { label: 'Book a Clarity Session', to: '/contact', variant: 'primary' },
  { label: 'Explore Experiences', to: '/experiences', variant: 'secondary' },
]

function ContactAction({ action }) {
  const className = `btn ${action.variant || 'secondary'}`

  if (action.href) {
    return (
      <a href={action.href} className={className} target="_blank" rel="noreferrer">
        {action.label}
      </a>
    )
  }

  return (
    <Link to={action.to} className={className}>
      {action.label}
    </Link>
  )
}

function ContactCTA({
  eyebrow = 'A Calm Place to Begin',
  title = 'When something no longer fits, clarity is the first doorway.',
  text = 'Start with one thoughtful conversation about your current season, what has shifted, and which path may support you best.',
  actions = defaultActions,
}) {
  return (
    <section className="section contact-section">
      <div className="section-header">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{text}</p>

        <div className="hero-actions">
          {actions.map((action) => <ContactAction action={action} key={action.label} />)}
        </div>
      </div>
    </section>
  )
}

export default ContactCTA
