import { Link } from 'react-router-dom'
import { experienceNavigation } from '../data/signatureExperiences.js'

function SignatureExperienceNav({ activePath }) {
  return (
    <nav className="signature-experience-nav" aria-label="Signature experiences">
      {experienceNavigation.map((item) => {
        const isActive = item.to === activePath
        const classNames = [item.featured ? 'is-featured' : '', isActive ? 'is-active' : ''].filter(Boolean).join(' ')

        return (
          <Link className={classNames || undefined} to={item.to} key={item.to} aria-current={isActive ? 'page' : undefined}>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default SignatureExperienceNav
