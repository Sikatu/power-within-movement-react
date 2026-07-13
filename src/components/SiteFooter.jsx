import { Link } from 'react-router-dom'
import instagramIcon from '../assets/images/icons/instagram.webp'
import spotifyIcon from '../assets/images/icons/spotify.webp'
import youtubeIcon from '../assets/images/icons/youtube.webp'
import logo from '../assets/images/logo.webp'
import './SiteFooter.css'

const socialLinks = [
  { label: 'Instagram', href: 'https://www.instagram.com/powerwithin_collective/', icon: instagramIcon },
  { label: 'YouTube', href: 'https://www.youtube.com/@PowerWithinCollective', icon: youtubeIcon },
  { label: 'Spotify', href: 'https://open.spotify.com/show/4ml9p7e5NLrUVqrd9HxnqT', icon: spotifyIcon },
  { label: 'Facebook', href: 'https://www.facebook.com/powerwithincollective', text: 'f' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/kimmittelstadt/', text: 'in' },
]

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div className="footer-brand">
          <img className="footer-logo" src={logo} alt="Power Within Collective logo" />
          <h2>Power Within Collective</h2>
          <p>Personal Presence, congruence, confidence, and self-recognition for women in a new season.</p>
          <div className="footer-socials">
            {socialLinks.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer" aria-label={link.label}>
                {link.icon ? <img src={link.icon} alt="" /> : <span>{link.text}</span>}
              </a>
            ))}
          </div>
        </div>

        <div className="footer-column">
          <h3>Explore</h3>
          <Link to="/">Home</Link>
          <Link to="/experiences">Experiences</Link>
          <Link to="/resources">The Vault</Link>
          <Link to="/professionals">Professionals</Link>
          <Link to="/podcast">Podcast</Link>
          <Link to="/teen-programs">Teen Programs</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        </div>

        <div className="footer-column">
          <h3>Resources</h3>
          <Link to="/resources#100-conversation-starters">100 Conversation Starters</Link>
          <Link to="/#newsletter">Newsletter</Link>
          <Link to="/contact?interest=speaking">Book Kim to Speak</Link>
          <Link to="/#faq">FAQ</Link>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
        </div>

        <div className="footer-connect">
          <h3>Stay Connected</h3>
          <p>Meaningful conversations. Helpful resources. Delivered with care.</p>
          <Link className="footer-newsletter-button" to="/#newsletter">Join the Newsletter</Link>
        </div>
      </div>

      <div className="footer-bottom">
        Copyright 2026 Power Within Movement, LLC. Power Within Collective is a brand of Power Within Movement, LLC. All rights reserved.
      </div>
    </footer>
  )
}

export default SiteFooter
