import { Link } from 'react-router-dom'
import instagramIcon from '../assets/images/icons/instagram.webp'
import spotifyIcon from '../assets/images/icons/spotify.webp'
import youtubeIcon from '../assets/images/icons/youtube.webp'
import { publicLinks } from '../config/publicLinks.js'
import './SiteFooter.css'

const socialLinks = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/powerwithin_collective/',
    icon: instagramIcon,
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@RaisingHerConfidence',
    icon: youtubeIcon,
  },
  {
    label: 'Spotify',
    href: 'https://open.spotify.com/show/4ml9p7e5NLrUVqrd9HxnqT',
    icon: spotifyIcon,
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/powerwithincollective',
    text: 'f',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/kimmittelstadt/',
    text: 'in',
  },
]

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div className="footer-brand">
          <img
            className="footer-logo"
            src="/favicon.webp"
            alt=""
          />

          <h2>Power Within Collective</h2>

          <p>
            Personal Presence for women entering a new chapter through
            color, beauty, style, confidence, self-expression, and
            intentional choice.
          </p>

          <div
            className="footer-socials"
            aria-label="Power Within social channels"
          >
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                aria-label={link.label}
              >
                {link.icon ? (
                  <img src={link.icon} alt="" />
                ) : (
                  <span>{link.text}</span>
                )}
              </a>
            ))}
          </div>
        </div>

        <nav
          className="footer-column"
          aria-label="Explore Power Within"
        >
          <h3>Explore</h3>

          <Link to="/radiance-reclaimed">
            Radiance Reclaimed
          </Link>

          <Link to="/experiences">
            Personal Presence
          </Link>

          <Link to="/about">
            About Kim
          </Link>

          <Link to="/resources">
            Resources
          </Link>

          <Link to="/professionals">
            For Professionals
          </Link>

          <Link to="/podcast">
            Podcast
          </Link>

          <Link to="/teen-programs">
            Teen &amp; Family
          </Link>

          <Link to="/contact">
            Contact
          </Link>
        </nav>

        <nav
          className="footer-column"
          aria-label="Resources and legal"
        >
          <h3>Resources</h3>

          <a
            href={publicLinks.conversationStarters}
            target="_blank"
            rel="noreferrer"
          >
            100 Conversation Starters
          </a>

          <a
            href={publicLinks.newsletter}
            target="_blank"
            rel="noreferrer"
          >
            The Power Within Edit
          </a>

          <Link to="/contact?interest=speaking">
            Book Kim to Speak
          </Link>

          <Link to="/faq">
            FAQ
          </Link>

          <Link to="/privacy-policy">
            Privacy Policy
          </Link>

          <Link to="/terms-and-conditions">
            Terms &amp; Conditions
          </Link>
        </nav>

        <div className="footer-connect">
          <h3>Stay Connected</h3>

          <p>
            Meaningful ideas for Personal Presence, confidence,
            style, self-expression, and the chapter you are in.
          </p>

          <a
            className="footer-newsletter-button"
            href={publicLinks.newsletter}
            target="_blank"
            rel="noreferrer"
          >
            Join The Power Within Edit
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        Copyright 2026 Power Within Movement, LLC.
        Power Within Collective is a brand of Power Within Movement, LLC.
        All rights reserved.
      </div>
    </footer>
  )
}

export default SiteFooter
