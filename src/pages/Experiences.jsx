import { Link } from 'react-router-dom'
import consultationImage from '../assets/images/consultation-detail.webp'
import experiencesImage from '../assets/images/experiences-private-guidance.webp'
import './Experiences.css'

const beginCards = [
  {
    number: '01',
    title: 'Radiance Reclaimed',
    text: 'For the woman ready to stop performing her life and start inhabiting it with congruence, aliveness, and visible presence.',
  },
  {
    number: '02',
    title: 'Power Shift Clarity Session',
    text: 'A focused whole-person conversation to name what has shifted, locate the gap, and create direction for the next aligned step.',
  },
  {
    number: '03',
    title: 'Personalized Appointments',
    text: 'For women who want beauty, color, style, or makeup guidance without committing to a deeper coaching experience.',
  },
]

const appointmentOptions = [
  {
    number: '01',
    title: 'Makeup Confidence Lesson',
    investment: '$350',
    time: '90 minutes',
    bestFor: 'A simple, flattering makeup routine taught step by step.',
    description: 'A focused beauty appointment for the woman who wants her makeup to feel natural, current, and easy to repeat.',
    included: ['Undertone and shade direction', 'Product and application guidance', 'A polished everyday routine'],
    thinking: 'I want to look like myself, just more pulled together.',
    to: '/blend-cosmetics',
    action: 'Explore Makeup Direction',
  },
  {
    number: '02',
    title: 'Beauty & Color Refresh',
    investment: '$497',
    time: '2 hours',
    bestFor: 'Makeup, color, and hair direction.',
    description: 'A refined refresh for women who want clearer direction around color, beauty choices, and what naturally supports their features.',
    included: ['Personal color guidance', 'Makeup shade and hair color direction', 'A more cohesive beauty picture'],
    thinking: 'I know something feels off, but I am not sure if it is color, makeup, or hair.',
    to: '/color-analysis',
    action: 'Explore Color Alignment',
  },
  {
    number: '03',
    title: 'Personal Presence Refresh',
    investment: '$697',
    time: '2.5–3 hours',
    bestFor: 'Beauty, color, style, proportion, and a 30-day plan.',
    description: 'A grounded reset for the woman whose body, lifestyle, or season of life has changed and wants practical direction.',
    included: ['Beauty, color, and style direction', 'Body shape and proportion guidance', 'A focused 30-day presence plan'],
    thinking: 'I need someone to help me see what works for who I am now.',
    to: '/style-analysis',
    action: 'Explore Style Alignment',
  },
  {
    number: '04',
    title: 'The Signature Day',
    investment: '$1,597 intro / $1,997',
    time: 'Two sessions, up to 6 hours',
    bestFor: 'Deep whole-person analysis across beauty, color, style, and personal presence.',
    description: 'An immersive appointment experience for the woman ready for deeper clarity across how she looks, feels, and shows up.',
    included: ['Beauty, color, style, and body analysis', 'Personal presence and wardrobe direction', 'A deeper integration plan for moving forward'],
    thinking: 'I have been guessing for a long time, and I am ready to understand what works and why.',
    to: '/contact',
    action: 'Get in Touch',
  },
]

const coverCards = [
  {
    title: 'Color Analysis',
    text: 'Personalized color direction for tones, neutrals, makeup shades, hair direction, and accent colors that naturally support your features and presence.',
    to: '/color-analysis',
  },
  {
    title: 'Style & Body Analysis',
    text: 'Guidance around personal style, body shape, proportion, silhouettes, wardrobe structure, and confidence in this season of life.',
    to: '/style-analysis',
  },
  {
    title: 'Makeup Lesson & Direction',
    text: 'A personal beauty experience focused on makeup, undertones, product direction, application, and a polished routine that feels repeatable.',
    to: '/blend-cosmetics',
  },
]

const chooseGuides = [
  {
    title: 'Choose the Makeup Confidence Lesson if:',
    points: ['Your main goal is learning a makeup routine that works for your face.', 'You feel overwhelmed or confused about products.', 'You want someone to teach you step by step.'],
  },
  {
    title: 'Choose the Beauty & Color Refresh if:',
    points: ['You want makeup help plus practical color and hair color direction.', 'You are unsure whether warm, cool, or neutral tones suit you best.', 'You want a more cohesive beauty picture without a full style appointment.'],
  },
  {
    title: 'Choose the Personal Presence Refresh if:',
    points: ['You want a meaningful reset across beauty, color, style, and presence.', 'Your body, lifestyle, or season of life has changed.', 'You need practical guidance without a full intensive analysis.'],
  },
  {
    title: 'Choose The Signature Day if:',
    points: ['You want deeper clarity, not just direction.', 'Your wardrobe, body, or personal presence feels significantly out of alignment.', 'You have been guessing for a long time and are ready to understand what works and why.'],
  },
]

function Experiences() {
  return (
    <main id="main-content" className="experiences-page">
      <section className="experiences-hero section-shell">
        <p className="eyebrow">Experiences</p>
        <h1>This is not a makeover. It is a return.</h1>
        <p>Experiences for women who want confidence, color, beauty, style, and personal presence to feel connected again.</p>
        <div className="experiences-mobile-actions">
          <a className="button button-primary" href="#appointment-services">Explore Appointment Options</a>
          <Link className="button button-secondary" to="/contact">Get in Touch</Link>
        </div>
      </section>

      <section className="experiences-intro section-shell">
        <div className="experiences-feature-copy">
          <p className="eyebrow">Ways to Begin</p>
          <h2>Every experience begins with the same question: what no longer feels aligned?</h2>
          <p>Confidence, energy, identity, wellness, color, style, and presence are not separate problems. They are connected expressions of one life, one body, one season, and one woman becoming more honest with herself.</p>
        </div>
        <img src={experiencesImage} alt="Private guidance consultation for confidence, image, and personal presence" />
      </section>

      <section className="experiences-begin section-shell">
        <div className="experiences-begin-grid">
          {beginCards.map((card) => (
            <article key={card.title}>
              <span>{card.number}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>

        <div className="experiences-mobile-overview">
          <p className="eyebrow">Ways to Begin</p>
          <h2>Choose the level of guidance that fits this season.</h2>
          <div>
            {appointmentOptions.map((option) => (
              <article key={option.title}>
                <span>{option.number}</span>
                <h3>{option.title}</h3>
                <p>{option.investment} · {option.time}. {option.bestFor}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="experiences-story section-shell">
        <p className="eyebrow">Beauty With Meaning</p>
        <h2>Sometimes the first doorway is practical: a better color, a softer makeup routine, a clearer silhouette, a way to feel like yourself again.</h2>
        <p>These appointment experiences make space for that. They are precise, personal, and confidence-building, without asking you to become someone else.</p>
      </section>

      <section className="experiences-appointments-dark">
        <div className="section-shell">
          <div className="experiences-appointment-intro">
            <div>
              <p className="eyebrow">Personalized Appointments</p>
              <h2>Beauty, Color &amp; Personal Presence Appointments</h2>
              <p className="experiences-appointment-lead">Practical guidance for women who are ready to feel more confident, current, and connected to themselves again.</p>
              <p>You do not always need a complete overhaul. Sometimes you need a grounded eye, an honest conversation, and clear direction around what supports your face, coloring, body, style, and season of life.</p>
              <div>
                <a className="button experiences-gold-button" href="#appointment-services">Explore Appointment Options</a>
                <Link className="button experiences-dark-outline" to="/contact">Get in Touch</Link>
              </div>
            </div>

            <aside className="experiences-consultation-card">
              <img src={consultationImage} alt="Notebook, color swatches, and consultation details for a personal presence session" />
              <p>Not sure which appointment is right for you?</p>
              <h3>Start with a complimentary Personal Presence Consultation.</h3>
              <span>No charge, no obligation.</span>
              <Link to="/contact">Schedule Complimentary Consultation</Link>
            </aside>
          </div>

          <div className="experiences-glance-heading">
            <p className="eyebrow">At a Glance</p>
            <h2>Choose the level of guidance that fits this season.</h2>
          </div>
          <div className="experiences-glance-grid">
            {appointmentOptions.map((option) => (
              <article key={option.title}>
                <span>{option.number}</span>
                <h3>{option.title}</h3>
                <dl>
                  <div><dt>Investment</dt><dd>{option.investment}</dd></div>
                  <div><dt>Time</dt><dd>{option.time}</dd></div>
                  <div><dt>Best for</dt><dd>{option.bestFor}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="experiences-cover section-shell">
        <header className="experiences-section-heading">
          <p className="eyebrow">What We Cover</p>
          <h2>A curated overview of beauty, color, style, and presence.</h2>
        </header>
        <div className="experiences-cover-grid">
          {coverCards.map((card) => (
            <Link to={card.to} key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              <strong>Explore <span aria-hidden="true">→</span></strong>
            </Link>
          ))}
        </div>
      </section>

      <section id="appointment-services" className="experiences-services section-shell scroll-target">
        <header className="experiences-section-heading">
          <p className="eyebrow">Appointment Experiences</p>
          <h2>Clear, personal direction without pressure to become someone else.</h2>
        </header>
        <div className="experiences-service-grid">
          {appointmentOptions.map((option) => (
            <article key={option.title}>
              <span className="experiences-service-number">{option.number}</span>
              <h3>{option.title}</h3>
              <p>{option.description}</p>
              <dl>
                <div><dt>Investment</dt><dd>{option.investment}</dd></div>
                <div><dt>Time</dt><dd>{option.time}</dd></div>
              </dl>
              <h4>What is included</h4>
              <ul>
                {option.included.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <blockquote>
                <h4>She might be thinking</h4>
                <p>“{option.thinking}”</p>
              </blockquote>
              <p className="experiences-best-for"><strong>Best for:</strong> {option.bestFor}</p>
              <Link className="button button-primary" to={option.to}>{option.action}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="experiences-choose section-shell">
        <header className="experiences-section-heading">
          <p className="eyebrow">How to Choose</p>
          <h2>Start with what feels most true right now.</h2>
        </header>
        <div className="experiences-choose-grid">
          {chooseGuides.map((guide) => (
            <article key={guide.title}>
              <h3>{guide.title}</h3>
              <ul>
                {guide.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="experiences-closing section-shell">
        <p className="eyebrow">Ready for Something Deeper?</p>
        <h2>Radiance Reclaimed addresses the whole woman, not just how she looks.</h2>
        <p>An appointment can help you feel more confident in how you show up. But if you are sensing something deeper, a gap between who you are becoming and how you are living, Radiance Reclaimed addresses the whole woman, not just how she looks.</p>
        <Link className="button button-primary" to="/radiance-reclaimed">Learn About Radiance Reclaimed</Link>
        <div>
          <p>This is not about becoming someone new.</p>
          <p>It is about showing up as the woman you already are.</p>
        </div>
      </section>
    </main>
  )
}

export default Experiences
