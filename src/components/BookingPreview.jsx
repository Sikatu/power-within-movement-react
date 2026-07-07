import { Link } from 'react-router-dom'

function BookingPreview() {
  return (
    <section className="section booking-section">
      <div className="booking-card">
        <div>
          <p className="eyebrow">Where Would You Like to Begin?</p>
          <h2>Choose the doorway that fits the season you are in.</h2>
          <p>
            Begin with a Power Shift Clarity Session, explore a practical appointment,
            or continue through professional education for deeper client experiences.
          </p>
        </div>

        <div className="hero-actions">
          <Link to="/contact" className="btn primary">Book a Clarity Session</Link>
          <Link to="/appointments#appointment-options" className="btn secondary">View Appointments</Link>
          <Link to="/professionals" className="btn secondary">For Professionals</Link>
        </div>
      </div>
    </section>
  )
}

export default BookingPreview

