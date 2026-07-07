import PageHero from '../components/PageHero'

function PrivacyPolicy() {
  return (
    <main>
      <PageHero
        eyebrow="Privacy Policy"
        title="Your privacy matters."
        text="Power Within Movement, LLC is committed to protecting your privacy and explaining how information is collected, used, and protected."
      />

      <section className="section legal-section">
        <div className="legal-content">
          <p className="legal-date">Last updated: January 2026</p>
          <a href="/privacy-policy-2026.pdf" className="btn secondary" target="_blank" rel="noreferrer">Download PDF</a>

          <h2>Information We Collect</h2>
          <p>We collect information voluntarily submitted through newsletter signups, contact forms, purchases, memberships, and digital content interactions.</p>

          <h2>How We Use Your Information</h2>
          <p>Information may be used to deliver services, process payments, communicate with you, send updates, and improve the website and customer experience.</p>

          <h2>Third-Party Services</h2>
          <p>Trusted providers may support hosting, email communication, payment processing, analytics, and business operations.</p>

          <h2>Cookies & Tracking</h2>
          <p>The website may use cookies or similar technologies to improve functionality and analyze site usage.</p>

          <h2>Your Rights & Choices</h2>
          <p>You may opt out of marketing emails or request access, correction, or deletion of your data by contacting hello@powerwithinmovement.com.</p>

          <h2>Contact</h2>
          <p>Questions may be sent to hello@powerwithinmovement.com.</p>
        </div>
      </section>
    </main>
  )
}

export default PrivacyPolicy
