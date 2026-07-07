import { Link } from 'react-router-dom'
import logo from '../assets/images/logo.webp'
import instagramIcon from '../assets/images/icons/instagram.webp'
import youtubeIcon from '../assets/images/icons/youtube.webp'
import spotifyIcon from '../assets/images/icons/spotify.webp'

const socialLinks = [
  {
    href: 'https://www.instagram.com/powerwithin_collective/',
    icon: instagramIcon,
    label: 'Instagram',
  },
  {
    href: 'https://www.youtube.com/@PowerWithinCollective',
    icon: youtubeIcon,
    label: 'YouTube',
  },
  {
    href:
      import.meta.env.VITE_SPOTIFY_URL ||
      'https://open.spotify.com/show/4ml9p7e5NLrUVqrd9HxnqT',
    icon: spotifyIcon,
    label: 'Spotify',
  },
  {
    href: 'https://www.facebook.com/powerwithincollective',
    textIcon: 'f',
    label: 'Facebook',
  },
  {
    href: 'https://www.linkedin.com/in/kimmittelstadt/',
    textIcon: 'in',
    label: 'LinkedIn',
  },
].filter((link) => Boolean(link.href))

function Footer() {
  return (
    <footer className="footer footer-premium">
      <div className="footer-premium-grid">
        <div className="footer-brand-block">
          <img src={logo} alt="Power Within Collective logo" className="footer-logo" />

          <h3>Power Within Collective</h3>
          <p>Personal Presence, congruence, confidence, and self-recognition for women in a new season.</p>

          <div className="footer-socials">
            {socialLinks.map((link) => (
              <a href={link.href} target="_blank" rel="noreferrer" aria-label={link.label} key={link.label}>
                {link.icon ? <img src={link.icon} alt="" /> : <span>{link.textIcon}</span>}
              </a>
            ))}
          </div>
        </div>

        <div className="footer-column">
          <span>Explore</span>
          <Link to="/">Home</Link>
          <Link to="/experiences">Experiences</Link>
          <Link to="/resources">The Vault</Link>
          <Link to="/professionals">Professionals</Link>
          <Link to="/podcast">Podcast</Link>
          <Link to="/teens">Teen Programs</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        </div>

        <div className="footer-column">
          <span>Resources</span>
          <Link to="/resources#100-conversation-starters">100 Conversation Starters</Link>
          <Link to="/#newsletter">Newsletter</Link>
          <Link to="/contact">Book Kim to Speak</Link>
          <Link to="/#faq">FAQ</Link>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-and-conditions">Terms & Conditions</Link>
        </div>

        <div className="footer-cta">
          <span>Stay Connected</span>
          <p>Meaningful conversations. Helpful resources. Delivered with care.</p>
          <Link to="/#newsletter" className="footer-newsletter-btn">Join the Newsletter</Link>
        </div>
      </div>

      <div className="footer-premium-bottom">
        Â© 2026 Power Within Movement, LLC. Power Within Collective is a brand of Power Within Movement, LLC. All rights reserved.
      </div>
    </footer>
  )
}

export default Footer


