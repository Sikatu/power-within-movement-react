import './Legal.css'

const sections = [
  {
    title: 'Website Use',
    body: 'These terms apply to your use of this website and the public content made available through it. Private client, member, Founder, Studio, and Developer areas may also be governed by separate service or access agreements.',
  },
  {
    title: 'Intellectual Property',
    body: 'Website content, including text, graphics, images, videos, audio, downloads, exercises, and digital resources, belongs to Power Within Movement, LLC unless otherwise noted and may not be reproduced without permission.',
  },
  {
    title: 'Trademarks',
    body: 'Logos, brand names, slogans, program names, and design elements associated with Power Within Collective may not be used without written permission.',
  },
  {
    title: 'Third-Party Links',
    body: 'This website may link to third-party websites or services for convenience. Power Within Movement, LLC does not control and is not responsible for their content, availability, security, or privacy practices.',
  },
  {
    title: 'Limitation of Liability',
    body: 'Use of this website is at your own risk. Public content is provided for informational and educational purposes and is not a substitute for professional medical, mental-health, legal, or financial advice.',
  },
]

export default function TermsAndConditions() {
  return (
    <main id="main-content" className="legal-page">
      <header className="legal-hero section-shell">
        <p className="eyebrow">Terms &amp; Conditions</p>
        <h1>Terms for using this website.</h1>
        <p>
          By accessing or using this website, you agree to the Terms &amp; Conditions of
          Power Within Movement, LLC.
        </p>
      </header>

      <div className="legal-layout section-shell">
        <aside className="legal-summary" aria-label="Terms and conditions document information">
          <span aria-hidden="true">PW</span>
          <div>
            <p className="eyebrow">Official document</p>
            <h2>Terms &amp; Conditions</h2>
          </div>
          <p>Last updated January 2026. Download the approved document for the complete terms.</p>
          <a className="button button-primary" href="/terms-and-conditions-2026.pdf" target="_blank" rel="noreferrer">
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
              Questions about these terms may be sent to{' '}
              <a href="mailto:hello@powerwithinmovement.com">hello@powerwithinmovement.com</a>.
            </p>
          </section>
        </article>
      </div>
    </main>
  )
}
