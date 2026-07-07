import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import ContactCTA from '../components/ContactCTA'
import professionalsImage from '../assets/images/professionals.webp'
import professionalConsultationImage from '../assets/images/professional-consultation.webp'
import professionalToolsImage from '../assets/images/professional-tools.webp'

const readyForItems = [
  'Clarify what makes your work different',
  'Create a more intentional client journey',
  'Strengthen your pricing, boundaries, and language',
  'Stop overgiving or under-communicating your value',
  'Build a named signature experience',
  'Lead consultations with more depth and confidence',
  'Communicate the transformation behind your work',
  'Move from scattered services into a refined professional standard',
]

const buildItems = [
  'A clearer professional identity',
  'A stronger Why You? positioning statement',
  'A named signature client experience',
  'A deeper consultation and intake process',
  'A premium client journey',
  'A refined pricing and boundary framework',
  'A transformation-centered offer structure',
  'Client language that communicates value',
  'Follow-up and next-step pathways',
  'Visibility confidence and professional self-trust',
  'A professional standard you can actually hold',
]

const methodSteps = [
  {
    title: 'Recognize the Gap',
    text:
      'See where your value, language, or client journey feels scattered, unclear, or smaller than the transformation you provide.',
  },
  {
    title: 'Reclaim the Professional Standard',
    text:
      'Strengthen your identity, pricing confidence, boundaries, and the way you hold the client relationship.',
  },
  {
    title: 'Build the Signature Experience',
    text:
      'Shape your offer, consultation flow, delivery process, transformation promise, and follow-up path.',
  },
  {
    title: 'Radiate the Offer',
    text:
      'Clarify your messaging, visibility, invitations, and the deeper value behind your work.',
  },
  {
    title: 'Expand the Pathways',
    text:
      'Explore aligned next steps such as premium experiences, workshops, ColorLab opportunities, speaking, small groups, or professional leadership.',
  },
]

const fitCards = [
  {
    title: 'Beauty & Image Professionals',
    text:
      'For stylists, makeup artists, color analysts, image consultants, estheticians, salon owners, and beauty educators.',
  },
  {
    title: 'Professionals Ready for Depth',
    text:
      'For the woman who knows her work helps clients reconnect with confidence, identity, and personal presence.',
  },
  {
    title: 'Service Providers Becoming Guides',
    text:
      'For the professional ready to refine her language, boundaries, standards, and client journey.',
  },
]

const workItems = [
  'Private 1:1 or small group format',
  'Coaching, teaching, and strategy',
  'Templates, prompts, and scripts',
  'Signature Experience Review',
  'Identity and positioning refinement',
  'Designed to elevate, not add more services',
]

function Professionals() {
  return (
    <main>
      <PageHero
        eyebrow={'Power Within Professional\u2122'}
        title="The future of beauty is not just service. It is transformation."
        text="A guided professional development experience for beauty and image professionals ready to turn their expertise into a premium, transformation-centered client experience."
      />

      <section className="pwp-hero-action-strip" aria-label="Professional page quick actions">
        <Link className="btn primary" to="/contact?interest=professionals">
          Book a Professional Signature Experience Call
        </Link>
        <a className="btn ghost" href="#signature-method">
          Explore the Method
        </a>
      </section>

      <section className="section story-section professional-hero-story-section pwp-hero-story">
        <div className="story-grid professional-hero-story-grid">
          <div className="story-image professional-hero-image">
            <img loading="lazy" src={professionalsImage} alt="Beauty and image professionals in a refined consultation setting" />
          </div>

          <div className="story-copy professional-hero-copy">
            <p className="eyebrow">Power Within Professional{'\u2122'}</p>
            <h2>You already know your work is deeper than the appointment.</h2>

            <p>
              You see women in transition. You hear their stories. You watch confidence shift when
              they feel seen, understood, and aligned.
            </p>

            <p>
              Power Within Professional{'\u2122'} helps you create the identity, structure,
              language, standards, and client journey to match the depth of the work you actually provide.
            </p>

            <div className="hero-actions pwp-hero-actions">
              <Link className="btn primary" to="/contact?interest=professionals">
                Book a Professional Signature Experience Call
              </Link>
            </div>

            <div className="professional-trust-row pwp-trust-row">
              <article>
                <span>Identity</span>
                <strong>Clearer</strong>
              </article>

              <article>
                <span>Experience</span>
                <strong>Premium</strong>
              </article>

              <article>
                <span>Client Work</span>
                <strong>Deeper</strong>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="section pwp-intro-section">
        <div className="section-header">
          <p className="eyebrow">Who This Is For</p>
          <h2>For the professional who knows her work is more than a service.</h2>
          <p>
            This experience is designed for experienced beauty and image professionals who are ready
            to elevate how they position, package, communicate, and deliver their work.
          </p>
        </div>

        <div className="cards pwp-fit-grid">
          {fitCards.map((card) => (
            <article className="card pwp-fit-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>

        <div className="pwp-check-panel">
          <h3>This may be for you if you are ready to:</h3>
          <ul className="pwp-check-list">
            {readyForItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section professional-shift-section pwp-problem-section">
        <div className="professional-shift-card pwp-problem-card">
          <p className="eyebrow">The Gap</p>
          <h2>Your expertise may be strong, but your experience may not yet reflect the full value of your work.</h2>
          <p>
            Many beauty and image professionals are highly skilled, but their business does not fully
            communicate the transformation they create. Their services may be beautiful, but their
            positioning feels unclear. Their client results may be powerful, but their offers still
            sound basic. They may have years of experience, but still struggle to answer, Why you?
          </p>
          <p>
            Power Within Professional{'\u2122'} helps bridge that gap by giving your work a clearer
            identity, stronger language, deeper structure, and a more premium client experience.
          </p>
        </div>
      </section>

      <section className="section pwp-build-section">
        <div className="section-header">
          <p className="eyebrow">What You Build</p>
          <h2>What you will build inside Power Within Professional{'\u2122'}</h2>
          <p>
            This is not about adding more services to an already full menu. It is about creating a
            more intentional standard for how your work is positioned, delivered, and remembered.
          </p>
        </div>

        <div className="pwp-build-showcase">
          <figure className="pwp-editorial-image-card pwp-tools-image">
            <img loading="lazy" src={professionalToolsImage} alt="Professional tools, swatches, notes, and refined client experience materials" />
            <figcaption>Intentional standards. Clearer language. Lasting impact.</figcaption>
          </figure>

          <div className="pwp-build-grid">
            {buildItems.map((item) => (
              <article className="pwp-build-item" key={item}>
                <span aria-hidden="true"></span>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="signature-method" className="section experiences pwp-method-section">
        <div className="section-header">
          <p className="eyebrow">Inside the Experience</p>
          <h2>The Signature Experience Method</h2>
          <p>
            A guided framework for helping your professional work become clearer, deeper, more
            structured, and easier for the right clients to understand.
          </p>
        </div>

        <div className="pwp-method-grid">
          {methodSteps.map((step, index) => (
            <article
              className={`pwp-method-card ${index === 4 ? 'pwp-method-card-wide' : ''}`}
              key={step.title}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section pwp-difference-section">
        <div className="pwp-difference-card">
          <p className="eyebrow">What Makes This Different</p>
          <h2>This is not another business course.</h2>
          <p>
            Most business programs teach professionals how to grow. Most beauty trainings teach
            professionals how to perform. Power Within Professional{'\u2122'} teaches professionals
            how to guide, structure, and communicate transformation.
          </p>
          <p>
            This experience sits at the intersection of beauty, image, confidence, identity, personal
            presence, wellness-informed communication, client experience, coaching skills,
            professional standards, and self-leadership.
          </p>
          <strong>
            This is where beauty and image professionals learn to stop offering isolated services and
            start creating meaningful signature experiences.
          </strong>
        </div>
      </section>

      <section className="section pwp-work-section">
        <div className="pwp-work-showcase">
          <div className="pwp-work-copy">
            <p className="eyebrow">How It Works</p>
            <h2>A guided professional buildout, not another course to consume.</h2>
            <p>
              The work is designed for professionals ready to elevate their client experience with
              clarity, structure, and guided implementation.
            </p>

            <div className="pwp-work-grid">
              {workItems.map((item) => (
                <article className="pwp-work-item" key={item}>
                  <span aria-hidden="true"></span>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </div>

          <figure className="pwp-editorial-image-card pwp-consultation-image">
            <img loading="lazy" src={professionalConsultationImage} alt="Professional consultation with a client in a calm refined studio" />
          </figure>
        </div>
      </section>

      <section className="section pwp-wellness-section">
        <div className="pwp-wellness-grid">
          <div className="pwp-wellness-copy">
            <p className="eyebrow">Wellness-Informed Approach</p>
            <h2>A wellness-informed approach that honors the whole woman.</h2>
            <p>
              Kim brings a wellness-informed approach to beauty, image, and personal presence,
              helping professionals understand that confidence is influenced not only by how a woman
              looks, but by how she feels, lives, leads, and reconnects with herself.
            </p>
          </div>

          <div className="pwp-scope-card">
            <h3>Clear professional scope</h3>
            <p>
              This program does not train professionals to diagnose, treat, prescribe, or advise
              medically. Instead, it helps them ask better questions, listen more deeply, and create a
              client experience that honors the whole woman while staying within professional scope.
            </p>
          </div>

          <div className="pwp-scope-card">
            <h3>Pattern reset and self-trust</h3>
            <p>
              Participants are guided through mindset and pattern-reset work to strengthen confidence,
              boundaries, pricing, visibility, follow-through, and professional self-trust.
            </p>
          </div>
        </div>
      </section>

      <section className="section pwp-closing-section">
        <div className="pwp-closing-card">
          <p className="eyebrow">Not For Everyone</p>
          <h2>For the professional ready to grow in depth, identity, standards, and client transformation.</h2>
          <p>
            Power Within Professional{'\u2122'} is not for professionals looking for quick marketing
            tricks, discount strategies, or another list of services to add to an already full menu.
          </p>
          <p>
            The future of beauty is not just service. It is transformation. And the professional who
            understands that will be the one women trust with more than the appointment.
          </p>
        </div>
      </section>

      <ContactCTA
        eyebrow="Professional Signature Experience"
        title="Ready to explore whether your current services can become a more premium signature client experience?"
        text="Begin with a Professional Signature Experience Call and explore whether Power Within Professional is the right next step for your work."
        actions={[
          { label: 'Book a Professional Signature Experience Call', to: '/contact?interest=professionals', variant: 'primary' },
        ]}
      />
    </main>
  )
}

export default Professionals