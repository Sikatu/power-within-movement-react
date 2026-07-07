import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import heroImage from '../assets/images/hero.webp'

function Hero() {
  return (
    <section className="hero hero-v2 home-hero">
      <div className="hero-v2-grid">
        <motion.div
          className="hero-v2-copy"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="eyebrow">Power Within Collective</p>

          <h1>
            You are not trying to become someone else.
            <span> You are returning to who you are now.</span>
          </h1>

          <p>
            A premium whole-person experience for women in a new season who are
            ready for confidence, color, style, and presence to feel congruent again.
          </p>

          <div className="hero-actions">
            <Link to="/experiences" className="btn primary">Explore Experiences</Link>
            <Link to="/contact" className="btn secondary">Book a Clarity Session</Link>
            <Link to="/professionals" className="btn secondary quiet">For Professionals</Link>
          </div>

          <div className="home-hero-proof" aria-label="Power Within focus areas">
            <span>Confidence</span>
            <span>Presence</span>
            <span>Style Alignment</span>
          </div>
        </motion.div>

        <motion.div
          className="hero-v2-image"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
        >
          <img src={heroImage} alt="Confident woman in a calm Power Within Collective setting" />
        </motion.div>
      </div>
    </section>
  )
}

export default Hero



