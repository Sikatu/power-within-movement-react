import { useEffect, useRef, useState } from 'react'
import { submitPublicContactInquiry } from '../lib/nativeApi'

const interestOptions = [
  'Ask About Radiance Reclaimed',
  'Book a Clarity Session',
  'Book Kim to Speak',
  'General Message',
  'Join the Professional Interest List',
  'Podcast / Collaboration',
  'Request 100 Conversation Starters',
  'Reserve a Color Analysis Experience',
  'Reserve a Makeup Lesson & Direction Experience',
  'Reserve a Style & Body Analysis Experience',
  'Teen Confidence / Mother-Daughter Support',
]

function ContactForm({
  initialInterest = '',
  initialMessage = '',
  contextLabel = '',
  isDirectedInquiry = false,
}) {
  const dropdownRef = useRef(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitStatus, setSubmitStatus] = useState({ loading: false, error: '' })
  const [interestOpen, setInterestOpen] = useState(false)
  const [interestError, setInterestError] = useState(false)
  const [form, setForm] = useState(() => ({
    name: '',
    email: '',
    interest: initialInterest,
    message: initialMessage,
  }))

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setInterestOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    if (submitted) {
      setSubmitted(false)
    }
  }

  const handleInterestSelect = (interest) => {
    setForm((current) => ({
      ...current,
      interest,
    }))

    setInterestOpen(false)
    setInterestError(false)

    if (submitted) {
      setSubmitted(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!isDirectedInquiry && !form.interest) {
      setInterestError(true)
      return
    }

    try {
      setSubmitStatus({ loading: true, error: '' })
      setSubmitted(false)

      await submitPublicContactInquiry({
        name: form.name.trim(),
        email: form.email.trim(),
        interest: form.interest || 'General Message',
        message: form.message.trim(),
        contextLabel,
        sourcePath: `${window.location.pathname}${window.location.search}`,
      })

      setSubmitted(true)
      setSubmitStatus({ loading: false, error: '' })
    } catch {
      setSubmitted(false)
      setSubmitStatus({
        loading: false,
        error: 'We could not send this message into the admin system yet. Please try again in a moment.',
      })
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="contact-name">Your name</label>
      <input
        id="contact-name"
        name="name"
        type="text"
        placeholder="Your name"
        value={form.name}
        onChange={handleChange}
        required
      />

      <label className="sr-only" htmlFor="contact-email">Your email</label>
      <input
        id="contact-email"
        name="email"
        type="email"
        placeholder="Your email"
        value={form.email}
        onChange={handleChange}
        required
      />

      {!isDirectedInquiry && (
        <div className="custom-select-field" ref={dropdownRef}>
          <label className="sr-only" htmlFor="contact-interest-trigger">
            What would you like to explore?
          </label>

          <button
            id="contact-interest-trigger"
            type="button"
            className={`custom-select-trigger ${form.interest ? 'has-value' : ''}`}
            aria-haspopup="listbox"
            aria-expanded={interestOpen}
            onClick={() => setInterestOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setInterestOpen(false)
              }
            }}
          >
            <span>{form.interest || 'What would you like to explore?'}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5" />
            </svg>
          </button>

          {interestOpen && (
            <div className="custom-select-menu" role="listbox" aria-label="Inquiry type">
              {interestOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={form.interest === option}
                  className={`custom-select-option ${form.interest === option ? 'selected' : ''}`}
                  onClick={() => handleInterestSelect(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {interestError && (
            <p className="form-field-note">Please choose the doorway that feels most aligned.</p>
          )}
        </div>
      )}

      <label className="sr-only" htmlFor="contact-message">Message</label>
      <textarea
        id="contact-message"
        name="message"
        placeholder={
          isDirectedInquiry
            ? 'Add any timing, goals, questions, or details you would like us to know.'
            : 'Tell us a little about your current season or what you are looking for.'
        }
        rows="5"
        value={form.message}
        onChange={handleChange}
        required
      />

      <button type="submit" disabled={submitStatus.loading}>{submitStatus.loading ? 'Sending...' : 'Send Message'}</button>

      {submitStatus.error && (
        <p className="form-error">
          {submitStatus.error}
        </p>
      )}

      {submitted && (
        <p className="form-success">
          Thank you. Your message was received and sent into the Power Within admin system.
        </p>
      )}
    </form>
  )
}

export default ContactForm



