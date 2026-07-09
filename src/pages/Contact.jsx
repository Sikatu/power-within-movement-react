import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import PageHero from '../components/PageHero'
import ContactForm from '../components/ContactForm'
import contactImage from '../assets/images/contact.webp'

const contactQueryMap = {
  teen: {
    label: 'Teen Confidence / Mother-Daughter Support',
    interest: 'Teen Confidence / Mother-Daughter Support',
    message: 'I would like to learn more about teen confidence or mother-daughter support.',
    type: 'teen',
  },
'100-conversation-starters': {
    label: '100 Conversation Starters',
    interest: 'Request 100 Conversation Starters',
    message: 'I would like access to the 100 Conversation Starters resource.',
    type: 'resource',
  },
  clarity: {
    label: 'Clarity Session',
    interest: 'Book a Clarity Session',
    message: 'I would like to learn more about booking a clarity session.',
    type: 'appointment',
  },
  'color-analysis': {
    label: 'Personal Color Alignment',
    interest: 'Reserve a Color Analysis Experience',
    message: 'I would like to learn more about Personal Color Alignment and reserve a color analysis experience.',
    type: 'appointment',
  },
  'style-analysis': {
    label: 'Style & Body Analysis',
    interest: 'Reserve a Style & Body Analysis Experience',
    message: 'I would like to learn more about Style & Body Analysis and reserve an appointment.',
    type: 'appointment',
  },
  'makeup-lesson': {
    label: 'Makeup Lesson & Direction',
    interest: 'Reserve a Makeup Lesson & Direction Experience',
    message: 'I would like to learn more about Makeup Lesson & Direction and reserve an appointment.',
    type: 'appointment',
  },
  radiance: {
    label: 'Radiance Reclaimed',
    interest: 'Ask About Radiance Reclaimed™',
    message: 'I would like to learn more about Radiance Reclaimed.',
    type: 'program',
  },
  professionals: {
    label: 'Professional Interest List',
    interest: 'Join the Professional Interest List',
    message: 'I would like to learn more about professional education or mentorship.',
    type: 'professional',
  },
  speaking: {
    label: 'Speaking Inquiry',
    interest: 'Book Kim to Speak',
    message: 'I would like to inquire about booking Kim to speak.',
    type: 'speaking',
  },
  podcast: {
    label: 'Podcast / Collaboration',
    interest: 'Podcast / Collaboration',
    message: 'I would like to connect about the podcast or a collaboration.',
    type: 'collaboration',
  },
}

function Contact() {
  const { search } = useLocation()

  const queryContext = useMemo(() => {
    const params = new URLSearchParams(search)
    const resource = params.get('resource')
    const interest = params.get('interest')

    if (resource && contactQueryMap[resource]) {
      return contactQueryMap[resource]
    }

    if (interest && contactQueryMap[interest]) {
      return contactQueryMap[interest]
    }

    return null
  }, [search])

  const isAppointmentInquiry = queryContext?.type === 'appointment'

  return (
    <main className="contact-page">
      <PageHero
        eyebrow={isAppointmentInquiry ? 'Appointment Inquiry' : 'Get in Touch'}
        title={
          isAppointmentInquiry
            ? 'Your starting point is already selected.'
            : 'You do not have to have it figured out. You just need to be ready.'
        }
        text={
          isAppointmentInquiry
            ? 'Share your details and any notes that will help us guide you toward the right next step.'
            : 'Whether you are interested in a clarity session, Radiance Reclaimed™, professional education, speaking, the podcast, or general questions, this is the place to begin.'
        }
      />

      <section className="section contact-page-section">
        <div className="contact-page-grid">
          <div className="contact-panel">
            <p className="eyebrow">
              {isAppointmentInquiry ? 'Appointment Request' : 'Start Here'}
            </p>
            <h2>
              {isAppointmentInquiry
                ? 'We already know where you are beginning.'
                : 'Start with the right support.'}
            </h2>
            <p>
              {isAppointmentInquiry
                ? 'The form below is prepared around your selected service. Add your contact details and anything you want Kim’s team to know.'
                : 'Choose the option closest to what you need, then share a few details. We will guide your message to the right next step.'}
            </p>

            {queryContext && (
              <div className="contact-query-note">
                <span>
                  {isAppointmentInquiry ? 'Appointment Interest Selected' : 'Selected Experience'}
                </span>
                <h3>
                  {isAppointmentInquiry
                    ? queryContext.label
                    : 'You’re in the right place.'}
                </h3>
                <p>
                  {isAppointmentInquiry ? (
                    <>
                      Your appointment interest is already selected. Add your details below, then personalize the message if needed.
                    </>
                  ) : (
                    <>
                      Because you came from <strong>{queryContext.label}</strong>, the form
                      below is already set with the best starting point.
                    </>
                  )}
                </p>
              </div>
            )}

            <ContactForm
              key={queryContext?.interest || 'general-contact'}
              initialInterest={queryContext?.interest}
              initialMessage={queryContext?.message}
              contextLabel={queryContext?.label}
              isDirectedInquiry={isAppointmentInquiry}
            />
          </div>

          <div className="contact-details contact-image-panel">
            <img loading="lazy" src={contactImage} alt="Warm consultation space for Power Within Collective" />

            <div>
              <span>Book a Clarity Session</span>
              <p>For women who know something has shifted and want a grounded place to begin.</p>
            </div>

            <div>
              <span>Ask About Radiance Reclaimed{'\u2122'}</span>
              <p>For women ready for a deeper whole-person transformation experience.</p>
            </div>

            <div>
              <span>Join the Professional Interest List</span>
              <p>For professionals interested in education, mentorship, color, style, or client experience training.</p>
            </div>

            <div>
              <span>Book Kim to Speak</span>
              <p>For conversations around confidence, presence, image, identity, and the next era of women’s leadership.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Contact





