import { useLocation } from 'react-router-dom'
import contactImage from '../assets/images/contact.webp'
import { publicLinks } from '../config/publicLinks.js'
import './Contact.css'

const contactExperiences = {
  radiance: {
    eyebrow: 'Radiance Reclaimed\u2122 Retreats',
    title: 'A thoughtful first step into the retreat conversation.',
    intro:
      'If Radiance Reclaimed feels relevant to the chapter you are in, begin by sharing what is changing and what you hope to understand, express, or choose more clearly.',
    handoffTitle: 'Start a Radiance Reclaimed conversation.',
    handoffText:
      'Use the private contact form to tell us a little about the chapter you are in and why the retreat caught your attention.',
    action: 'Open the Private Contact Form',
  },
  'color-analysis': {
    eyebrow: 'Color Analysis',
    title: 'Begin with the colors that need to feel clear again.',
    intro:
      'Share what feels uncertain about your current color direction, wardrobe, makeup, hair, or the way you want to show up now.',
    handoffTitle: 'Start your Color Analysis conversation.',
    handoffText:
      'Use the private contact form to share what you want clearer direction around and what prompted you to explore color now.',
    action: 'Ask About Color Analysis',
  },
  'style-analysis': {
    eyebrow: 'Style + Body Analysis',
    title: 'Begin with the wardrobe or style question you can already see.',
    intro:
      'Share what has changed in your body, lifestyle, wardrobe, priorities, or sense of style and where getting dressed no longer feels as clear as it once did.',
    handoffTitle: 'Start your Style Direction conversation.',
    handoffText:
      'Use the private contact form to tell us what currently feels difficult, disconnected, or ready for clearer wardrobe direction.',
    action: 'Ask About Style Direction',
  },
  'makeup-lesson': {
    eyebrow: 'Makeup + Beauty Direction',
    title: 'Begin with the beauty choices you want to feel easier.',
    intro:
      'Share what feels unclear about shades, products, application, color, or creating an everyday finish that still feels like you.',
    handoffTitle: 'Start your Makeup Direction conversation.',
    handoffText:
      'Use the private contact form to tell us what you want your makeup routine or beauty direction to help you understand more clearly.',
    action: 'Ask About Makeup Direction',
  },
  professionals: {
    eyebrow: 'Power Within Professional\u2122',
    title: 'Begin with the professional experience you are ready to build more intentionally.',
    intro:
      'Share where your current client experience, positioning, signature offer, language, standards, or professional direction feels ready for greater depth.',
    handoffTitle: 'Book a Professional Signature Experience Call.',
    handoffText:
      'Use the private contact form to tell us about your work, the clients you serve, and where greater clarity, structure, or depth would help. Your message is the first step in arranging the call.',
    action: 'Request the Signature Experience Call',
  },
  teens: {
    eyebrow: 'Teen + Family Support',
    title: 'Begin with the conversation that feels most important right now.',
    intro:
      'Share what your teen, family, or mother-daughter relationship is navigating and what kind of confidence, connection, or communication support you are looking for.',
    handoffTitle: 'Start a Teen + Family support conversation.',
    handoffText:
      'Use the private contact form to share a little about the current situation and what would make support feel useful and appropriate.',
    action: 'Ask About Teen + Family Support',
  },
  speaking: {
    eyebrow: 'Speaking + Collaboration',
    title: 'Bring Kim into a conversation that deserves depth.',
    intro:
      'Share a little about your audience, organization, event, collaboration, or conversation and what you would like Kim to help people explore.',
    handoffTitle: 'Start a speaking or collaboration conversation.',
    handoffText:
      'Use the private contact form to share the event, audience, timing, and the kind of conversation or contribution you have in mind.',
    action: 'Ask About Speaking',
  },
}

const generalContact = {
  eyebrow: 'Get in Touch',
  title:
    'You do not have to have it figured out. You just need a place to begin.',
  intro:
    'Whether you are exploring a private experience, professional work, teen support, speaking, collaboration, or simply have a question, this is a thoughtful place to start.',
  handoffTitle: 'Begin the conversation when you are ready.',
  handoffText:
    'Use the private contact form to share a little about what is bringing you here and what kind of support or conversation you are looking for.',
  action: 'Send a Message',
}

function Contact() {
  const { search } = useLocation()
  const interest = new URLSearchParams(search).get('interest')
  const experience = contactExperiences[interest] || generalContact

  return (
    <main id="main-content" className="contact-page">
      <section className="contact-hero section-shell">
        <p className="eyebrow">{experience.eyebrow}</p>

        <h1>{experience.title}</h1>

        <p>{experience.intro}</p>
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

          <h2>{experience.handoffTitle}</h2>

          <p>{experience.handoffText}</p>

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
            {experience.action}
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
