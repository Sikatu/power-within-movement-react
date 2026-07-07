import { useState } from 'react'

const interestOptions = [
  'Book a Clarity Session',
  'Ask About Radiance Reclaimed\u2122',
  'Request 100 Conversation Starters',
  'Join the Professional Interest List',
  'Book Kim to Speak',
  'Podcast / Collaboration',
  
  'Teen Confidence / Mother-Daughter Support','General Message',
]

function ContactForm({ initialInterest = '', initialMessage = '' }) {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState(() => ({
    name: '',
    email: '',
    interest: initialInterest,
    message: initialMessage,
  }))

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

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
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

      <label className="sr-only" htmlFor="contact-interest">What would you like to explore?</label>
      <select
        id="contact-interest"
        name="interest"
        value={form.interest}
        onChange={handleChange}
        required
      >
        <option value="">What would you like to explore?</option>
        {interestOptions.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>

      <label className="sr-only" htmlFor="contact-message">Message</label>
      <textarea
        id="contact-message"
        name="message"
        placeholder="Tell us a little about your current season or what you are looking for."
        rows="5"
        value={form.message}
        onChange={handleChange}
        required
      />

      <button type="submit">Send Message</button>

      {submitted && (
        <p className="form-success">
          Thank you - your message has been received.
        </p>
      )}
    </form>
  )
}

export default ContactForm
