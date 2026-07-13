import { useState } from 'react'
import { Link } from 'react-router-dom'
import heroImage from '../assets/images/hero.webp'
import storyImage from '../assets/images/story.webp'
import './Home.css'

const layers = [
  { number: '01', title: 'Confidence', text: 'Not something to perform, but something that returns through congruence.' },
  { number: '02', title: 'Energy', text: 'The foundation that supports how you live, lead, care, and show up.' },
  { number: '03', title: 'Identity', text: 'The honest recognition of who you are now, not only who you had to be.' },
]

const fiveRs = [
  { number: '01', title: 'Regulate', text: 'Create clarity around how you want to move through life and show up in the world.' },
  { number: '02', title: 'Restore', text: 'Support your energy, confidence, and personal foundation so you have something real to give from.' },
  { number: '03', title: 'Reconnect', text: 'Realign with the woman you have become, internally and externally.' },
  { number: '04', title: 'Reclaim', text: 'Strengthen your confidence, personal presence, and sense of self.' },
  { number: '05', title: 'Reflect', text: 'Allow the outside to fully express your identity, energy, and evolution.' },
]

const beginOptions = [
  {
    number: '01',
    title: 'Start with Clarity',
    text: 'A one-hour, whole-person conversation designed to identify what no longer feels aligned and begin mapping a more intentional path forward.',
    action: 'Book a Clarity Session',
    to: '/contact',
  },
  {
    number: '02',
    title: 'Radiance Reclaimed',
    text: 'A transformational experience for the woman ready to stop showing up as a polished version of who she used to be.',
    action: 'Explore the Experience',
    to: '/radiance-reclaimed',
  },
  {
    number: '03',
    title: 'For Professionals',
    text: 'Education for beauty, wellness, image, and coaching professionals who want to lead the next era with more presence.',
    action: 'View Professional Pathways',
    to: '/professionals',
  },
]

const faqs = [
  { question: 'Where do I begin?', answer: 'Begin with a Power Shift Clarity Session. It is a calm, whole-person conversation designed to name what has shifted and clarify the next aligned step.' },
  { question: 'Is this a makeover?', answer: 'No. Radiance Reclaimed is not about becoming someone else. It is about helping your outer expression catch up with who you are now.' },
  { question: 'Who is this work for?', answer: 'This work is for women in a new season who want to feel current, clear, visible, and at home within themselves without chasing youth or performing confidence.' },
  { question: 'Do you work with professionals?', answer: 'Yes. Power Within Collective supports beauty, wellness, image, and coaching professionals who want to create deeper, more personal client experiences.' },
]

function Home() {
  const [joined, setJoined] = useState(false)

  const joinNewsletter = (event) => {
    event.preventDefault()
    setJoined(true)
  }

  return (
    <main id="main-content" className="home-page">
      <section className="home-hero section-shell">
        <div className="home-hero-copy">
          <p className="eyebrow">Power Within Collective</p>
          <h1>You are not trying to become someone else. <em>You are returning to who you are now.</em></h1>
          <p className="home-hero-lead">A premium whole-person experience for women in a new season who are ready for confidence, color, style, and presence to feel congruent again.</p>
          <div className="home-hero-actions">
            <Link className="button button-primary" to="/experiences">Explore Experiences</Link>
            <Link className="button button-secondary" to="/contact">Book a Clarity Session</Link>
            <Link className="button button-text" to="/professionals">For Professionals</Link>
          </div>
          <div className="home-focus-tags" aria-label="Power Within focus areas">
            <span>Confidence</span>
            <span>Presence</span>
            <span>Style Alignment</span>
          </div>
        </div>
        <div className="home-hero-visual">
          <span aria-hidden="true" />
          <img src={heroImage} alt="Confident woman in a calm Power Within Collective setting" />
        </div>
      </section>

      <section className="home-story section-shell">
        <img src={storyImage} alt="Women in conversation through Power Within Collective" />
        <div>
          <p className="eyebrow">Personal Presence</p>
          <h2>You are not starting over. You are returning to yourself.</h2>
          <p>Personal presence begins when the outside finally reflects the woman you have become.</p>
          <p>Your responsibilities may have changed. Your priorities may have shifted. The way you show up may no longer reflect who you are now.</p>
          <p>This work helps close the gap between the life you are living and the life that finally feels true.</p>
        </div>
      </section>

      <section className="home-layers dark-band">
        <div className="section-shell">
          <header className="section-heading section-heading-on-dark">
            <p className="eyebrow">The Congruence Conversation</p>
            <h2>It is not one thing. It is layered.</h2>
            <p>Confidence, wellness, identity, personal presence, style, energy, and lifestyle are not separate problems. They are different expressions of one life.</p>
          </header>
          <div className="layer-grid">
            {layers.map((layer) => (
              <article key={layer.title}>
                <span>{layer.number}</span>
                <h3>{layer.title}</h3>
                <p>{layer.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-framework section-shell">
        <header className="section-heading">
          <p className="eyebrow">The 5Rs Framework</p>
          <h2>Confidence deepens when the inside and outside begin working together.</h2>
        </header>
        <div className="framework-grid">
          {fiveRs.map((item) => (
            <article key={item.title}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-begin section-shell">
        <header className="section-heading">
          <p className="eyebrow">Where Would You Like to Begin?</p>
          <h2>The goal is not a makeover. It is a return.</h2>
        </header>
        <div className="begin-grid">
          {beginOptions.map((option) => (
            <Link to={option.to} key={option.title}>
              <span>{option.number}</span>
              <h3>{option.title}</h3>
              <p>{option.text}</p>
              <strong>{option.action} <span aria-hidden="true">→</span></strong>
            </Link>
          ))}
        </div>
      </section>

      <section id="newsletter" className="home-newsletter section-shell scroll-target">
        <div className="newsletter-card">
          <p className="eyebrow">Stay Connected</p>
          <h2>Notes for the woman in a new season.</h2>
          <p>Receive thoughtful reflections on congruence, Personal Presence, color, style, confidence, and the quiet work of returning to yourself.</p>
          <form onSubmit={joinNewsletter}>
            <label className="sr-only" htmlFor="newsletter-email">Email address</label>
            <input id="newsletter-email" type="email" autoComplete="email" placeholder="Enter your email" required />
            <button type="submit">Join the List</button>
          </form>
          {joined && <p className="newsletter-success" role="status">Thank you — you are on the list.</p>}
        </div>
      </section>

      <section id="faq" className="home-faq section-shell scroll-target">
        <header className="section-heading">
          <p className="eyebrow">FAQ</p>
          <h2>Questions before you begin.</h2>
        </header>
        <div className="faq-list">
          {faqs.map((faq) => (
            <article key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-closing section-shell">
        <p className="eyebrow">A Thoughtful Place to Begin</p>
        <h2>Start with the doorway that fits the season you are in.</h2>
        <p>Whether you need clarity, a practical appointment, or a deeper whole-person experience, the next step can be calm, personal, and clear.</p>
        <div>
          <Link className="button button-primary" to="/experiences">Explore Experiences</Link>
          <Link className="button button-secondary" to="/contact">Book a Clarity Session</Link>
        </div>
      </section>
    </main>
  )
}

export default Home
