import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToHash() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    if (!hash) return

    const targetId = decodeURIComponent(hash.replace('#', ''))

    const timer = window.setTimeout(() => {
      const target = document.getElementById(targetId)

      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }
    }, 120)

    return () => window.clearTimeout(timer)
  }, [hash, pathname])

  return null
}
