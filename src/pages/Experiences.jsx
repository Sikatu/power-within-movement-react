import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import experiencesImage from '../assets/images/experiences-private-guidance.webp'
import appointmentsImage from '../assets/images/appointments-studio-atmosphere.webp'

const appointmentOptions = [
  {
    number: '01',
    title: 'Makeup Confidence Lesson',
    investment: '$350',
    time: '90 minutes',
    bestFor: 'A simple, flattering makeup routine taught step by step.',
    description:
      'A focused beauty appointment for the woman who wants her makeup to feel natural, current, and easy to repeat.',
    included: [
      'Undertone and shade direction',
      'Product and application guidance',
      'A polished everyday routine',
    ],
    thinking: 'I want to look like myself, just more pulled together.',
    href: '/blend-cosmetics',
    cta: 'Explore Makeup Direction',
  },
  {
    number: '02',
    title: 'Beauty & Color Refresh',
    investment: '$497',
    time: '2 hours',
    bestFor: 'Makeup, color, and hair direction.',
    description:
      'A refined refresh for women who want clearer direction around color, beauty choices, and what naturally supports their features.',
    included: [
      'Personal color guidance',
      'Makeup shade and hair color direction',
      'A more cohesive beauty picture',
    ],
    thinking: 'I know something feels off, but I am not sure if it is color, makeup, or hair.',
    href: '/color-analysis',
    cta: 'Explore Color Alignment',
  },
  {
    number: '03',
    title: 'Personal Presence Refresh',
    investment: '$697',
    time: '2.5-3 hours',
    bestFor: 'Beauty, color, style, proportion, and a 30-day plan.',
    description:
      'A grounded reset for the woman whose body, lifestyle, or season of life has changed and wants practical direction.',
    included: [
      'Beauty, color, and style direction',
      'Body shape and proportion guidance',
      'A focused 30-day presence plan',
    ],
    thinking: 'I need someone to help me see what works for who I am now.',
    href: '/style-analysis',
    cta: 'Explore Style Alignment',
  },
  {
    number: '04',
    title: 'The Signature Day',
    investment: '$1,597 introductory / $1,997 standard',
    time: 'Two personal sessions, up to 6 hours',
    bestFor: 'Deep whole-person analysis across beauty, color, style, and personal presence.',
    description:
      'An immersive appointment experience for the woman ready for deeper clarity across how she looks, feels, and shows up.',
    included: [
      'Beauty, color, style, and body analysis',
      'Personal presence and wardrobe direction',
      'A deeper integration plan for moving forward',
    ],
    thinking: 'I have been guessing for a long time, and I am ready to understand what works and why.',
    href: '/contact',
    cta: 'Get in Touch',
  },
]

const coverCards = [
  {
    title: 'Color Analysis',
    text:
      'Personalized color direction for tones, neutrals, makeup shades, hair direction, and accent colors that naturally support your features and presence.',
    href: '/color-analysis',
  },
  {
    title: 'Style & Body Analysis',
    text:
      'Guidance around personal style, body shape, proportion, silhouettes, wardrobe structure, and confidence in this season of life.',
    href: '/style-analysis',
  },
  {
    title: 'Makeup Lesson & Direction',
    text:
      'A personal beauty experience focused on makeup, undertones, product direction, application, and a polished routine that feels repeatable.',
    href: '/blend-cosmetics',
  },
]

const chooseGuides = [
  {
    title: 'Choose the Makeup Confidence Lesson if:',
    points: [
      'Your main goal is learning a makeup routine that works for your face.',
      'You feel overwhelmed or confused about products.',
      'You want someone to teach you step by step.',
    ],
  },
  {
    title: 'Choose the Beauty & Color Refresh if:',
    points: [
      'You want makeup help plus practical color and hair color direction.',
      'You are unsure whether warm, cool, or neutral tones suit you best.',
      'You want a more cohesive beauty picture without a full style appointment.',
    ],
  },
  {
    title: 'Choose the Personal Presence Refresh if:',
    points: [
      'You want a meaningful reset across beauty, color, style, and presence.',
      'Your body, lifestyle, or season of life has changed.',
      'You need practical guidance without a full intensive analysis.',
    ],
  },
  {
    title: 'Choose The Signature Day if:',
    points: [
      'You want deeper clarity, not just direction.',
      'Your wardrobe, body, or personal presence feels significantly out of alignment.',
      'You have been guessing for a long time and are ready to understand what works and why.',
    ],
  },
]

function ConsultationCallout({ compact = false }) {
  return (
    <div className={compact ? 'appointment-callout compact' : 'appointment-callout'}>
      <p>Not sure which appointment is right for you?</p>
      <h3>Start with a complimentary Personal Presence Consultation.</h3>
      <span>No charge, no obligation.</span>
      <Link to="/contact" className="btn secondary">Schedule Complimentary Consultation</Link>
    </div>
  )
}

function Experiences() {
  return (
    <main>
      <PageHero
        eyebrow="Experiences"
        title="This is not a makeover. It is a return."
        text="Experiences for women who want confidence, color, beauty, style, and personal presence to feel connected again."
      />

      <section className="section intro-section">
        <div className="experience-feature-grid">
          <div className="section-header">
            <p className="eyebrow">Ways to Begin</p>
            <h2>Every experience begins with the same question: what no longer feels aligned?</h2>
            <p>
              Confidence, energy, identity, wellness, color, style, and presence are not
              separate problems. They are connected expressions of one life, one body,
              one season, and one woman becoming more honest with herself.
            </p>
          </div>

          <div className="experience-feature-image">
            <img
              loading="lazy"
              src={experiencesImage}
              alt="Private guidance consultation for confidence, image, and personal presence"
            />
          </div>
        </div>

        <div className="cards">
          <article className="card"><span>01</span><h3>Radiance Reclaimed</h3><p>For the woman ready to stop performing her life and start inhabiting it with congruence, aliveness, and visible presence.</p></article>
          <article className="card"><span>02</span><h3>Power Shift Clarity Session</h3><p>A focused whole-person conversation to name what has shifted, locate the gap, and create direction for the next aligned step.</p></article>
          <article className="card"><span>03</span><h3>Personalized Appointments</h3><p>For women who want beauty, color, style, or makeup guidance without committing to a deeper coaching experience.</p></article>
        </div>

        <div className="experience-story-note">
          <p className="eyebrow">Beauty With Meaning</p>
          <h3>Sometimes the first doorway is practical: a better color, a softer makeup routine, a clearer silhouette, a way to feel like yourself again.</h3>
          <p>
            These appointment experiences make space for that. They are precise,
            personal, and confidence-building, without asking you to become someone else.
          </p>
        </div>
      </section>

      <section className="section appointment-section" id="appointment-options">
        <div className="appointment-shell">
          <div className="appointment-intro-grid">
            <div className="appointment-intro-copy">
              <p className="eyebrow">Personalized Appointments</p>
              <h2>Beauty, Color & Personal Presence Appointments</h2>
              <p className="appointment-lead">
                Practical guidance for women who are ready to feel more confident,
                current, and connected to themselves again.
              </p>
              <p>
                You do not always need a complete overhaul. Sometimes you need a grounded
                eye, an honest conversation, and clear direction around what supports your
                face, coloring, body, style, and season of life.
              </p>

              <div className="hero-actions">
                <Link to="/appointments#appointment-services" className="btn primary">Explore Appointment Options</Link>
                <Link to="/contact" className="btn secondary">Get in Touch</Link>
              </div>
            </div>

            <ConsultationCallout />
          </div>

          <div className="appointment-atmosphere-image">
            <img
              loading="lazy"
              src={appointmentsImage}
              alt="Calm private studio prepared for a personal appointment"
            />
          </div>

          <div className="appointment-subheader">
            <p className="eyebrow">At a Glance</p>
            <h3>Choose the level of guidance that fits this season.</h3>
          </div>

          <div className="appointment-glance-grid">
            {appointmentOptions.map((option) => (
              <article className="appointment-glance-card" key={option.title}>
                <span>{option.number}</span>
                <h4>{option.title}</h4>
                <dl>
                  <div><dt>Investment</dt><dd>{option.investment}</dd></div>
                  <div><dt>Time</dt><dd>{option.time}</dd></div>
                  <div><dt>Best for</dt><dd>{option.bestFor}</dd></div>
                </dl>
              </article>
            ))}
          </div>

          <div className="appointment-subheader">
            <p className="eyebrow">What We Cover</p>
            <h3>A curated overview of beauty, color, style, and presence.</h3>
          </div>

          <div className="appointment-cover-grid">
            {coverCards.map((card) => (
              <Link to={card.href} className="appointment-cover-card" key={card.title}>
                <h4>{card.title}</h4>
                <p>{card.text}</p>
                <span>Explore</span>
              </Link>
            ))}
          </div>

          <div className="appointment-subheader" id="appointment-services">
            <p className="eyebrow">Appointment Experiences</p>
            <h3>Clear, personal direction without pressure to become someone else.</h3>
          </div>

          <div className="appointment-service-grid">
            {appointmentOptions.map((option) => (
              <article className="appointment-service-card" key={option.title}>
                <div>
                  <span>{option.number}</span>
                  <h4>{option.title}</h4>
                  <p>{option.description}</p>
                </div>

                <div className="appointment-meta-row">
                  <div><strong>{option.investment}</strong><small>Investment</small></div>
                  <div><strong>{option.time}</strong><small>Time</small></div>
                </div>

                <div>
                  <h5>What is included</h5>
                  <ul>
                    {option.included.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>

                <div className="thinking-note">
                  <h5>She might be thinking</h5>
                  <p>{option.thinking}</p>
                </div>

                <p className="best-for"><strong>Best for:</strong> {option.bestFor}</p>

                <Link to={option.href} className="btn primary">{option.cta}</Link>
              </article>
            ))}
          </div>

          <div className="appointment-choice-section">
            <div className="appointment-subheader">
              <p className="eyebrow">How to Choose</p>
              <h3>Start with what feels most true right now.</h3>
            </div>

            <div className="appointment-choice-grid">
              {chooseGuides.map((guide) => (
                <article className="appointment-choice-card" key={guide.title}>
                  <h4>{guide.title}</h4>
                  <ul>
                    {guide.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </div>

          <ConsultationCallout compact />

          <div className="appointment-bridge">
            <p className="eyebrow">Ready for Something Deeper?</p>
            <h3>Radiance Reclaimed addresses the whole woman, not just how she looks.</h3>
            <p>
              An appointment can help you feel more confident in how you show up. But if
              you are sensing something deeper, a gap between who you are becoming and
              how you are living, Radiance Reclaimed addresses the whole woman, not just
              how she looks.
            </p>
            <Link to="/radiance-reclaimed" className="btn primary">Learn About Radiance Reclaimed</Link>
          </div>

          <div className="appointment-closing">
            <p>This is not about becoming someone new.</p>
            <p>It is about showing up as the woman you already are.</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Experiences

