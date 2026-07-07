import { useState } from 'react'

function Newsletter() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <section className="section newsletter-section">
      <div className="newsletter-card">
        <p className="eyebrow">Stay Connected</p>
        <h2>Notes for the woman in a new season.</h2>
        <p>
          Receive thoughtful reflections on congruence, Personal Presence, color,
          style, confidence, and the quiet work of returning to yourself.
        </p>

        <form className="newsletter-form" onSubmit={handleSubmit}>
          <input type="email" placeholder="Enter your email" required />
          <button type="submit">Join the List</button>
        </form>

        {submitted && (
          <p className="form-success">Thank you - you are on the list.</p>
        )}
      </div>
    </section>
  )
}

export default Newsletter

