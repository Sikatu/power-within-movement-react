import { Link } from 'react-router-dom'
import { experienceNavigation } from '../data/signatureExperiences.js'

function SignatureExperienceNav({ activePath }) {
  const focusedExperiences =
    experienceNavigation.filter(
      (item) => !item.featured,
    )

  return (
    <nav
      className="focused-experience-nav"
      aria-label="Focused Personal Presence experiences"
    >
      {focusedExperiences.map((item) => {
        const isActive = item.to === activePath

        return (
          <Link
            className={isActive ? 'is-active' : undefined}
            to={item.to}
            key={item.to}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default SignatureExperienceNav
