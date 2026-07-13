import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import contactImage from '../assets/images/contact.webp'
import { submitPublicContactInquiry } from '../lib/nativeApi.js'
import './Contact.css'

const contactQueryMap = {
  teen: {
    label: 'Teen Confidence / Mother-Daughter Support',
    interest: 'Teen Confidence / Mother-Daughter Support',
    message: 'I would like to learn more about teen confidence or mother-daughter support.',
  },
  '100-conversation-starters': {
    label: '100 Conversation Starters',
    interest: 'Request 100 Conversation Starters',
    message: 'I would like access to the 100 Conversation Starters resource.',
  },
  clarity: {
    label: 'Clarity Session',
    interest: 'Book a Clarity Session',
    message: 'I would like to learn more about booking a clarity session.',
  },
  'color-analysis': {
    label: 'Personal Color Alignment',
    interest: 'Reserve a Color Analysis Experience',
    message: 'I would like to learn more about Personal Color Alignment and reserve a color analysis experience.',
  },
  'style-analysis': {
    label: 'Style & Body Analysis',
    interest: 'Reserve a Style & Body Analysis Experience',
    message: 'I would like to learn more about Style & Body Analysis and reserve an appointment.',
  },
  'makeup-lesson': {
    label: 'Makeup Lesson & Direction',
    interest: 'Reserve a Makeup Lesson & Direction Experience',
    message: 'I would like to learn more about Makeup Lesson & Direction and reserve an appointment.',
  },
  radiance: {
    label: 'Radiance Reclaimed™',
    interest: 'Ask About Radiance Reclaimed™',
    message: 'I would like to learn more about Radiance Reclaimed™.',
  },
  professionals: {
    label: 'Professional Interest List',
    interest: 'Join the Professional Interest List',
    message: 'I would like to learn more about professional education or mentorship.',
  },
  speaking: {
    label: 'Speaking Inquiry',
    interest: 'Book Kim to Speak',
    message: 'I would like to inquire about booking Kim to speak.',
  },
  podcast: {
    label: 'Podcast / Collaboration',
    interest: 'Podcast / Collaboration',
    message: 'I would like to connect about the podcast or a collaboration.',
  },
}

const interestOptions = [
  'Book a Clarity Session',
  'Reserve a Color Analysis Experience',
  'Reserve a Style & Body Analysis Experience',
  'Reserve a Makeup Lesson & Direction Experience',
  'Ask About Radiance Reclaimed™',
  'Teen Confidence / Mother-Daughter Support',
  'Join the Professional Interest List',
  'Book Kim to Speak',
  'Podcast / Collaboration',
  'Request 100 Conversation Starters',
  'General Question',
]

const pathways = [
  { title: 'Book a Clarity Session', text: 'For women who know something has shifted and want a grounded place to begin.' },
  { title: 'Ask About Radiance Reclaimed™', text: 'For women ready for a deeper whole-person transformation experience.' },
  { title: 'Join the Professional Interest List', text: 'For professionals interested in education, mentorship, color, style, or client experience training.' },
  { title: 'Book Kim to Speak', text: 'For conversations around confidence, presence, image, identity, and the next era of women’s leadership.' },
]

function createInitialForm(queryContext) {
  return {
    firstName: '',
    lastName: '',
    email: '',
    interest: queryContext?.interest || '',
    message: queryContext?.message || '',
  }
}

function Contact() {
  const { search } = useLocation()
  const queryContext = useMemo(() => {
    const params = new URLSearchParams(search)
    const key = params.get('resource') || params.get('interest')
    return key ? contactQueryMap[key] || null : null
  }, [search])
  const [form, setForm] = useState(() => createInitialForm(queryContext))
  const [status, setStatus] = useState({ state: 'idle', message: '' })

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (status.state === 'error') setStatus({ state: 'idle', message: '' })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ state: 'loading', message: '' })

    try {
      await submitPublicContactInquiry({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email.trim(),
        interest: form.interest,
        message: form.message.trim(),
        contextLabel: queryContext?.label || form.interest,
        sourcePath: `${window.location.pathname}${window.location.search}`,
      })
      setStatus({ state: 'success', message: '' })
    } catch {
      setStatus({
        state: 'error',
        message: 'We could not send your message into the Power Within admin system. Please try again in a moment.',
      })
    }
  }

  const resetForm = () => {
    setForm(createInitialForm(queryContext))
    setStatus({ state: 'idle', message: '' })
  }

  return (
    <main id="main-content" className="contact-page">
      <section className="contact-hero section-shell">
        <p className="eyebrow">Get in Touch</p>
        <h1>You do not have to have it figured out. You just need to be ready.</h1>
        <p>Whether you are interested in a clarity session, Radiance Reclaimed™, professional education, speaking, the podcast, or general questions, this is the place to begin.</p>
      </section>

      <section className="contact-layout section-shell">
        <article className="contact-form-panel">
          <p className="eyebrow">Start Here</p>
          <h2>Start with the right support.</h2>
          <p>Choose the option closest to what you need, then share a few details. We will guide your message to the right next step.</p>

          {queryContext && status.state !== 'success' && (
            <div className="contact-context-note">
              <span>Selected Starting Point</span>
              <strong>{queryContext.label}</strong>
              <p>Your inquiry and message are prepared below. You can personalize either before sending.</p>
            </div>
          )}

          {status.state === 'success' ? (
            <div className="contact-success" role="status">
              <span aria-hidden="true">✓</span>
              <h3>Thank you—your message is on its way.</h3>
              <p>Kim&apos;s team will respond personally within two business days.</p>
              <button className="button button-secondary" type="button" onClick={resetForm}>Send Another Message</button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="contact-name-fields">
                <label>
                  <span>First Name</span>
                  <input name="firstName" type="text" autoComplete="given-name" placeholder="Your first name" value={form.firstName} onChange={handleChange} required />
                </label>
                <label>
                  <span>Last Name</span>
                  <input name="lastName" type="text" autoComplete="family-name" placeholder="Your last name" value={form.lastName} onChange={handleChange} required />
                </label>
              </div>

              <label>
                <span>Email</span>
                <input name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
              </label>

              <label>
                <span>I&apos;m Interested In</span>
                <select name="interest" value={form.interest} onChange={handleChange} required>
                  <option value="" disabled>Choose the closest fit</option>
                  {interestOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>

              <label>
                <span>Message</span>
                <textarea name="message" rows="5" placeholder="Share a little about your season and what kind of guidance would be most useful." value={form.message} onChange={handleChange} required />
              </label>

              <button className="contact-submit" type="submit" disabled={status.state === 'loading'}>
                {status.state === 'loading' ? 'Sending…' : 'Send Message'}
              </button>
              {status.state === 'error' && <p className="contact-error" role="alert">{status.message}</p>}
            </form>
          )}
        </article>

        <aside className="contact-pathways">
          <img src={contactImage} alt="Warm consultation space for Power Within Collective" />
          <div>
            {pathways.map((pathway) => (
              <article key={pathway.title}>
                <h3>{pathway.title}</h3>
                <p>{pathway.text}</p>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  )
}

export default Contact
