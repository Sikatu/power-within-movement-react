import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import storyImage from '../assets/images/story.webp'

const ContactCTA = lazy(() => import('../components/ContactCTA'))
const FAQ = lazy(() => import('../components/FAQ'))
const Newsletter = lazy(() => import('../components/Newsletter'))
const BookingPreview = lazy(() => import('../components/BookingPreview'))

const beginOptions = [
  {
    number: '01',
    title: 'Start with Clarity',
    text: 'A one-hour, whole-person conversation designed to identify what no longer feels aligned and begin mapping a more intentional path forward.',
    to: '/contact',
    action: 'Book a Clarity Session',
  },
  {
    number: '02',
    title: 'Radiance Reclaimed',
    text: 'A transformational experience for the woman ready to stop showing up as a polished version of who she used to be.',
    to: '/radiance-reclaimed',
    action: 'Explore the Experience',
  },
  {
    number: '03',
    title: 'For Professionals',
    text: 'Education for beauty, wellness, image, and coaching professionals who want to lead the next era with more presence.',
    to: '/professionals',
    action: 'View Professional Pathways',
  },
]

function Home() {
  return (
    <main className="home-page">
      <Hero />

      <section className="section story-section home-story-section">
        <div className="story-grid">
          <div className="story-image">
            <img loading="lazy" src={storyImage} alt="Women in conversation through Power Within Collective" />
          </div>

          <div className="story-copy">
            <p className="eyebrow">Personal Presence</p>
            <h2>You are not starting over. You are returning to yourself.</h2>
            <p>
              Personal presence begins when the outside finally reflects the woman
              you have become.
            </p>
            <p>
              Your responsibilities may have changed. Your priorities may have shifted.
              The way you show up may no longer reflect who you are now.
            </p>
            <p>
              This work helps close the gap between the life you are living and the
              life that finally feels true.
            </p>
          </div>
        </div>
      </section>

      <section className="section intro-section home-layer-section">
        <div className="section-header">
          <p className="eyebrow">The Congruence Conversation</p>
          <h2>It is not one thing. It is layered.</h2>
          <p>
            Confidence, wellness, identity, personal presence, style, energy, and
            lifestyle are not separate problems. They are different expressions of one life.
          </p>
        </div>

        <div className="cards">
          <article className="card"><span>01</span><h3>Confidence</h3><p>Not something to perform, but something that returns through congruence.</p></article>
          <article className="card"><span>02</span><h3>Energy</h3><p>The foundation that supports how you live, lead, care, and show up.</p></article>
          <article className="card"><span>03</span><h3>Identity</h3><p>The honest recognition of who you are now, not only who you had to be.</p></article>
        </div>
      </section>

      <section id="experiences" className="section experiences home-framework-section">
        <div className="section-header">
          <p className="eyebrow">The 5Rs Framework</p>
          <h2>Confidence deepens when the inside and outside begin working together.</h2>
        </div>

        <div className="cards five-grid">
          <article className="card"><span>01</span><h3>Regulate</h3><p>Create clarity around how you want to move through life and show up in the world.</p></article>
          <article className="card"><span>02</span><h3>Restore</h3><p>Support your energy, confidence, and personal foundation so you have something real to give from.</p></article>
          <article className="card"><span>03</span><h3>Reconnect</h3><p>Realign with the woman you have become, internally and externally.</p></article>
          <article className="card"><span>04</span><h3>Reclaim</h3><p>Strengthen your confidence, personal presence, and sense of self.</p></article>
          <article className="card"><span>05</span><h3>Reflect</h3><p>Allow the outside to fully express your identity, energy, and evolution.</p></article>
        </div>
      </section>

      <section className="section intro-section home-begin-section">
        <div className="section-header">
          <p className="eyebrow">Where Would You Like to Begin?</p>
          <h2>The goal is not a makeover. It is a return.</h2>
        </div>

        <div className="cards begin-grid">
          {beginOptions.map((option) => (
            <Link to={option.to} className="card begin-card" key={option.title}>
              <span>{option.number}</span>
              <h3>{option.title}</h3>
              <p>{option.text}</p>
              <strong className="card-action">{option.action}</strong>
            </Link>
          ))}
        </div>
      </section>

      <Suspense fallback={null}>
        <BookingPreview />
      <div id="newsletter" className="home-anchor-target">
        <Newsletter />
      </div>
      <div id="faq" className="home-anchor-target">
        <FAQ />
      </div>
      <ContactCTA
        eyebrow="A Thoughtful Place to Begin"
        title="Start with the doorway that fits the season you are in."
        text="Whether you need clarity, a practical appointment, or a deeper whole-person experience, the next step can be calm, personal, and clear."
        actions={[
          { label: 'Explore Experiences', to: '/experiences', variant: 'primary' },
          { label: 'Book a Clarity Session', to: '/contact', variant: 'secondary' },
        ]}
      />
      </Suspense>
    </main>
  )
}

export default Home

