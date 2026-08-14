import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import contactImage from '../assets/images/contact.webp'
import './Contact.css'

const FLODESK_CONTACT_URL = 'https://powerwithinmovement.myflodesk.com/contact'

const contactContexts = {
  clarity: {
    eyebrow: 'Clarity Session',
    title: 'Ready for a clearer place to begin?',
    text: 'Share what is shifting, what feels out of alignment, and what kind of support would feel most useful right now.',
    action: 'Ask About a Clarity Session',
  },
  'color-analysis': {
    eyebrow: 'Personal Color Alignment',
    title: 'Ready to explore your most supportive colors?',
    text: 'Begin a conversation about color analysis, clothing, makeup, accessories, hair direction, and the shades that help you feel more like yourself.',
    action: 'Ask About Color Analysis',
  },
  'style-analysis': {
    eyebrow: 'Style & Body Analysis',
    title: 'Ready for clearer style direction?',
    text: 'Begin a conversation about personal style, proportion, body changes, wardrobe direction, and how you want to show up in this season.',
    action: 'Ask About Style & Body Analysis',
  },
  'makeup-lesson': {
    eyebrow: 'Makeup Lesson & Direction',
    title: 'Ready for makeup to feel simpler and more like you?',
    text: 'Begin a conversation about makeup direction, undertones, products, application, and a polished routine that feels natural and repeatable.',
    action: 'Ask About Makeup Direction',
  },
  radiance: {
    eyebrow: 'Radiance Reclaimed™',
    title: 'Ready to explore something deeper?',
    text: 'Share where you are, what has shifted, and what you are hoping to reclaim. This begins with a thoughtful conversation about fit.',
    action: 'Ask About Radiance Reclaimed™',
  },
  professionals: {
    eyebrow: 'Power Within Professional™',
    title: 'Ready to deepen the experience behind your work?',
    text: 'Begin a conversation about professional education, signature experiences, client transformation, mentorship, or collaboration.',
    action: 'Start a Professional Conversation',
  },
  teen: {
    eyebrow: 'Teen Confidence',
    title: 'Looking for thoughtful support for a girl becoming herself?',
    text: 'Begin a conversation about teen confidence, identity, self-image, mother-daughter connection, or the support that may fit best.',
    action: 'Ask About Teen Support',
  },
  speaking: {
    eyebrow: 'Speaking',
    title: 'Interested in bringing Kim into the conversation?',
    text: 'Share a little about your event, audience, organization, or conversation you would like Kim to be part of.',
    action: 'Ask About Speaking',
  },
  podcast: {
    eyebrow: 'Podcast & Collaboration',
    title: 'Have an idea for a meaningful conversation?',
    text: 'Reach out about Raising Her Confidence, podcast opportunities, partnerships, interviews, or aligned collaborations.',
    action: 'Start the Conversation',
  },
}

const defaultContext = {
  eyebrow: 'Get in Touch',
  title: 'You do not have to have it figured out. You just need to be ready.',
  text: 'Whether you are exploring an experience, professional work, teen support, speaking, or simply have a question, this is a thoughtful place to begin.',
  action: 'Send a Message',
}

function Contact() {
  const { search } = useLocation()

  const context = useMemo(() => {
    const params = new URLSearchParams(search)
    const key = params.get('interest')

    return key ? contactContexts[key] || defaultContext : defaultContext
  }, [search])

  return (
    <main id="main-content" className="contact-page">
      <section className="contact-hero section-shell">
        <p className="eyebrow">{context.eyebrow}</p>
        <h1>{context.title}</h1>
        <p>{context.text}</p>
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
            href={FLODESK_CONTACT_URL}
            target="_blank"
            rel="noreferrer"
          >
            {context.action}
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