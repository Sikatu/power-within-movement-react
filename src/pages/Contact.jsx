import { useLocation } from 'react-router-dom'
import contactImage from '../assets/images/contact.webp'
import { publicLinks } from '../config/publicLinks.js'
import './Contact.css'

function Contact() {
  const { search } = useLocation()
  const interest = new URLSearchParams(search).get('interest')
  const isRadiance = interest === 'radiance'

  return (
    <main id="main-content" className="contact-page">
      <section className="contact-hero section-shell">
        {isRadiance ? (
          <>
            <p className="eyebrow">Radiance Reclaimed&trade; Retreats</p>

            <h1>A thoughtful first step into the retreat conversation.</h1>

            <p>
              If Radiance Reclaimed feels relevant to the chapter you are in,
              you can begin by sharing what is changing and what you hope to
              understand, express, or choose more clearly.
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">Get in Touch</p>

            <h1>
              You do not have to have it figured out. You just need a place
              to begin.
            </h1>

            <p>
              Whether you are exploring a private experience, professional
              work, teen support, speaking, collaboration, or simply have a
              question, this is a thoughtful place to start.
            </p>
          </>
        )}
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

          <h2>
            {isRadiance
              ? 'Start a Radiance Reclaimed conversation.'
              : 'Begin the conversation when you are ready.'}
          </h2>

          <p>
            {isRadiance
              ? 'Use the private contact form to tell us a little about the chapter you are in and why the retreat caught your attention.'
              : 'Use the private contact form to share a little about what is bringing you here and what kind of support or conversation you are looking for.'}
          </p>

          <p>
            You do not need to know exactly what comes next. Starting with a
            clear, human conversation is enough.
          </p>

          <a
            className="button button-primary contact-flodesk-button"
            href={publicLinks.contact}
            target="_blank"
            rel="noreferrer"
          >
            {isRadiance ? 'Open the Private Contact Form' : 'Send a Message'}
            <span aria-hidden="true"> &rarr;</span>
          </a>

          <small>
            The contact form opens securely through Flodesk in a new tab.
          </small>
        </article>
      </section>

      <section className="contact-reassurance section-shell">
        <p className="eyebrow">Power Within Collective</p>

        <h2>Invitation first. Pressure never.</h2>

        <p>
          Reaching out is simply a way to understand the next step more
          clearly. You will not be asked to arrive with every answer already
          figured out.
        </p>
      </section>
    </main>
  )
}

export default Contact
