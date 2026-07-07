import PageHero from '../components/PageHero'

function TermsAndConditions() {
  return (
    <main>
      <PageHero
        eyebrow="Terms & Conditions"
        title="Terms for using this website."
        text="By accessing or using this website, you agree to the Terms & Conditions of Power Within Movement, LLC."
      />

      <section className="section legal-section">
        <div className="legal-content">
          <p className="legal-date">Last updated: January 2026</p>
          <a href="/terms-and-conditions-2026.pdf" className="btn secondary" target="_blank" rel="noreferrer">Download PDF</a>

          <h2>Website Use</h2>
          <p>These terms apply to use of this website and any content made available through it.</p>

          <h2>Intellectual Property</h2>
          <p>All website content, including text, graphics, images, videos, audio, downloads, and digital resources, belongs to Power Within Movement, LLC unless otherwise noted.</p>

          <h2>Trademarks</h2>
          <p>Logos, brand names, slogans, program names, and design elements may not be used without permission.</p>

          <h2>Third-Party Links</h2>
          <p>This website may link to third-party services. Power Within Movement, LLC is not responsible for their content or practices.</p>

          <h2>Limitation of Liability</h2>
          <p>Use of this website is at your own risk. Content is provided for informational purposes.</p>

          <h2>Contact</h2>
          <p>Questions may be sent to hello@powerwithinmovement.com.</p>
        </div>
      </section>
    </main>
  )
}

export default TermsAndConditions
