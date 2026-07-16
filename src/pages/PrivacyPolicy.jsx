import './Legal.css'

const sections = [
  {
    title: 'Information We Collect',
    body: 'We collect information voluntarily submitted through newsletter signups, contact forms, purchases, memberships, client services, and digital content interactions.',
  },
  {
    title: 'How We Use Your Information',
    body: 'Information may be used to deliver services, process payments, communicate with you, send requested updates, protect private accounts, and improve the website and client experience.',
  },
  {
    title: 'Third-Party Services',
    body: 'Trusted providers may support hosting, email communication, payment processing, file storage, analytics, scheduling, and business operations. They receive only the information needed to provide those services.',
  },
  {
    title: 'Cookies & Tracking',
    body: 'The website may use cookies or similar technologies to provide secure sessions, remember preferences, improve functionality, and understand site usage.',
  },
  {
    title: 'Your Rights & Choices',
    body: 'You may unsubscribe from marketing emails or request access, correction, or deletion of your personal information. Some records may be retained when required for legal, security, or legitimate business purposes.',
  },
]

export default function PrivacyPolicy() {
  return (
    <main id="main-content" className="legal-page">
      <header className="legal-hero section-shell">
        <p className="eyebrow">Privacy Policy</p>
        <h1>Your privacy matters.</h1>
        <p>
          Power Within Movement, LLC is committed to protecting personal information and explaining
          how it is collected, used, and safeguarded across Power Within Collective.
        </p>
      </header>

      <div className="legal-layout section-shell">
        <aside className="legal-summary" aria-label="Privacy policy document information">
          <span aria-hidden="true">PW</span>
          <div>
            <p className="eyebrow">Official document</p>
            <h2>Privacy Policy</h2>
          </div>
          <p>Last updated January 2026. Download the approved document for the complete policy.</p>
          <a className="button button-primary" href="/privacy-policy-2026.pdf" target="_blank" rel="noreferrer">
            Download the PDF
          </a>
          <small>Power Within Collective is a brand of Power Within Movement, LLC.</small>
        </aside>

        <article className="legal-document">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
          <section>
            <h2>Contact</h2>
            <p>
              Privacy questions and requests may be sent to{' '}
              <a href="mailto:hello@powerwithinmovement.com">hello@powerwithinmovement.com</a>.
            </p>
          </section>
        </article>
      </div>
    </main>
  )
}
