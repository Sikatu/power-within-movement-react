import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function ScrollToTop() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    if (hash) {
      const scrollToHash = () => {
        const target = document.getElementById(hash.slice(1)) || document.querySelector(hash)
        target?.scrollIntoView({ behavior: 'smooth' })
      }

      window.requestAnimationFrame(scrollToHash)
      const fallbacks = [120, 600, 1200].map((delay) => window.setTimeout(scrollToHash, delay))
      return () => fallbacks.forEach((fallback) => window.clearTimeout(fallback))
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [hash, pathname])

  return null
}

export default ScrollToTop

