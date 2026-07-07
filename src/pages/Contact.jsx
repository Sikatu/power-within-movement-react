import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import PageHero from '../components/PageHero'
import ContactForm from '../components/ContactForm'
import contactImage from '../assets/images/contact.webp'

const contactQueryMap = {
  '100-conversation-starters': {
    label: '100 Conversation Starters',
    interest: 'Request 100 Conversation Starters',
    message: 'I would like access to the 100 Conversation Starters resource.',
  },
  clarity: {
    label: 'Clarity Session',
    interest: 'Book a Clarity Session',
    message: 'I would like to learn more about booking a clarity session.',
  },
  radiance: {
    label: 'Radiance Reclaimed',
    interest: 'Ask About Radiance Reclaimed\u2122',
    message: 'I would like to learn more about Radiance Reclaimed.',
  },
  professionals: {
    label: 'Professional Interest List',
    interest: 'Join the Professional Interest List',
    message: 'I would like to learn more about professional education or mentorship.',
  },
  speaking: {
    label: 'Speaking Inquiry',
    interest: 'Book Kim to Speak',
    message: 'I would like to inquire about booking Kim to speak.',
  },
  podcast: {
    label: 'Podcast / Collaboration',
    interest: 'Podcast / Collaboration',
    message: 'I would like to connect about the podcast or a collaboration.',
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

  return (
    <main>
      <PageHero
        eyebrow="Get in Touch"
        title="You do not have to have it figured out. You just need to be ready."
        text={"Whether you are interested in a clarity session, Radiance Reclaimed\u2122, professional education, speaking, the podcast, or general questions, this is the place to begin."}
      />

      <section className="section contact-page-section">
        <div className="contact-page-grid">
          <div className="contact-panel">
            <p className="eyebrow">Send a Message</p>
            <h2>Choose the doorway that feels most aligned.</h2>
            <p>
              Share what you are interested in, where you are in your current season,
              and what kind of support you are looking for.
            </p>

            {queryContext && (
              <div className="contact-query-note">
                <span>Starting Point Detected</span>
                <h3>We will route this to the right place.</h3>
                <p>
                  Because you came from <strong>{queryContext.label}</strong>, the form
                  below is already set with the best starting point.
                </p>
              </div>
            )}

            <ContactForm
              key={queryContext?.interest || 'general-contact'}
              initialInterest={queryContext?.interest}
              initialMessage={queryContext?.message}
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

