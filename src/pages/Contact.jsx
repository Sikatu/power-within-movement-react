import contactImage from '../assets/images/contact.webp'
import { publicLinks } from '../config/publicLinks.js'
import './Contact.css'


function Contact() {
  return (
    <main id="main-content" className="contact-page">
      <section className="contact-hero section-shell">
        <p className="eyebrow">Get in Touch</p>
        <h1>You do not have to have it figured out. You just need to be ready.</h1>
        <p>Whether you are exploring an experience, professional work, teen support, speaking, or simply have a question, this is a thoughtful place to begin.</p>
      </section>

      <section className="contact-handoff section-shell">
        <div className="contact-handoff-image">
          <span aria-hidden="true" />
          <img
            src={contactImage}
            alt="Warm Power Within Collective consultation setting"
          />
        </div>

        <article className="contact-handoff-card">
          <p className="eyebrow">A Simple Next Step</p>

          <h2>Begin the conversation when you are ready.</h2>

          <p>
            Power Within keeps the first step simple. Use the private contact form
            to share a little about what is bringing you here and what kind of
            support or conversation you are looking for.
          </p>

          <p>
            You do not need to know exactly which experience is right for you.
            Starting the conversation is enough.
          </p>

          <a
            className="button button-primary contact-flodesk-button"
            href={publicLinks.contact}
            target="_blank"
            rel="noreferrer"
          >
            Send a Message
            <span aria-hidden="true"> →</span>
          </a>

          <small>
            The contact form opens securely through Flodesk in a new tab.
          </small>
        </article>
      </section>

      <section className="contact-reassurance section-shell">
        <p className="eyebrow">Power Within Collective</p>
        <h2>A conversation first. Pressure never.</h2>
        <p>
          The goal of reaching out is not to have every answer. It is simply to
          create enough space to understand what you need and whether Power Within
          is the right place to support your next step.
        </p>
      </section>
    </main>
  )
}

export default Contact