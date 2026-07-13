import { Link } from 'react-router-dom'
import professionalConsultationImage from '../assets/images/professional-consultation.webp'
import professionalToolsImage from '../assets/images/professional-tools.webp'
import professionalsImage from '../assets/images/professionals-collaboration-studio.webp'
import './Professionals.css'

const trustItems = [
  { label: 'Identity', value: 'Clearer' },
  { label: 'Experience', value: 'Premium' },
  { label: 'Client Work', value: 'Deeper' },
]

const fitCards = [
  { title: 'Beauty & Image Professionals', text: 'For stylists, makeup artists, color analysts, image consultants, estheticians, salon owners, and beauty educators.' },
  { title: 'Professionals Ready for Depth', text: 'For the woman who knows her work helps clients reconnect with confidence, identity, and personal presence.' },
  { title: 'Service Providers Becoming Guides', text: 'For the professional ready to refine her language, boundaries, standards, and client journey.' },
]

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
  { number: '01', title: 'Recognize the Gap', text: 'See where your value, language, or client journey feels scattered, unclear, or smaller than the transformation you provide.' },
  { number: '02', title: 'Reclaim the Professional Standard', text: 'Strengthen your identity, pricing confidence, boundaries, and the way you hold the client relationship.' },
  { number: '03', title: 'Build the Signature Experience', text: 'Shape your offer, consultation flow, delivery process, transformation promise, and follow-up path.' },
  { number: '04', title: 'Radiate the Offer', text: 'Clarify your messaging, visibility, invitations, and the deeper value behind your work.' },
  { number: '05', title: 'Expand the Pathways', text: 'Explore aligned next steps such as premium experiences, workshops, ColorLab opportunities, speaking, small groups, or professional leadership.' },
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
    <main id="main-content" className="professionals-page">
      <section className="professionals-hero section-shell">
        <p className="eyebrow">Power Within Professional™</p>
        <h1>The future of beauty is not just service. It is transformation.</h1>
        <p>A guided professional development experience for beauty and image professionals ready to turn their expertise into a premium, transformation-centered client experience.</p>
        <div>
          <Link className="button button-primary" to="/contact?interest=professionals">Book a Professional Signature Experience Call</Link>
          <a className="button button-secondary" href="#signature-method">Explore the Method</a>
        </div>
      </section>

      <section className="professionals-intro section-shell">
        <div className="professionals-image-frame">
          <span aria-hidden="true" />
          <img src={professionalsImage} alt="Beauty and image professionals in a refined consultation setting" />
        </div>
        <div>
          <p className="eyebrow">Power Within Professional™</p>
          <h2>You already know your work is deeper than the appointment.</h2>
          <p>You see women in transition. You hear their stories. You watch confidence shift when they feel seen, understood, and aligned.</p>
          <p>Power Within Professional™ helps you create the identity, structure, language, standards, and client journey to match the depth of the work you actually provide.</p>
          <div className="professionals-trust-grid">
            {trustItems.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="professionals-fit section-shell">
        <header className="professionals-section-heading">
          <p className="eyebrow">Who This Is For</p>
          <h2>For the professional who knows her work is more than a service.</h2>
          <p>This experience is designed for experienced beauty and image professionals who are ready to elevate how they position, package, communicate, and deliver their work.</p>
        </header>
        <div className="professionals-fit-grid">
          {fitCards.map((card) => (
            <article key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
        <aside className="professionals-ready-panel">
          <h3>This may be for you if you are ready to:</h3>
          <ul>
            {readyForItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </aside>
      </section>

      <section className="professionals-gap-band">
        <div>
          <p className="eyebrow">The Gap</p>
          <h2>Your expertise may be strong, but your experience may not yet reflect the full value of your work.</h2>
          <p>Many beauty and image professionals are highly skilled, but their business does not fully communicate the transformation they create. Their services may be beautiful, but their positioning feels unclear. Their client results may be powerful, but their offers still sound basic. They may have years of experience, but still struggle to answer, Why you?</p>
          <p>Power Within Professional™ helps bridge that gap by giving your work a clearer identity, stronger language, deeper structure, and a more premium client experience.</p>
        </div>
      </section>

      <section className="professionals-build section-shell">
        <header className="professionals-section-heading">
          <p className="eyebrow">What You Build</p>
          <h2>What you will build inside Power Within Professional™</h2>
          <p>This is not about adding more services to an already full menu. It is about creating a more intentional standard for how your work is positioned, delivered, and remembered.</p>
        </header>
        <div className="professionals-build-showcase">
          <figure>
            <img src={professionalToolsImage} alt="Professional tools, swatches, notes, and refined client experience materials" />
            <figcaption>Intentional standards. Clearer language. Lasting impact.</figcaption>
          </figure>
          <div>
            {buildItems.map((item) => (
              <article key={item}><span aria-hidden="true" /><p>{item}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section id="signature-method" className="professionals-method section-shell scroll-target">
        <header className="professionals-section-heading">
          <p className="eyebrow">Inside the Experience</p>
          <h2>The Signature Experience Method</h2>
          <p>A guided framework for helping your professional work become clearer, deeper, more structured, and easier for the right clients to understand.</p>
        </header>
        <div>
          {methodSteps.map((step) => (
            <article key={step.title}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="professionals-difference section-shell">
        <p className="eyebrow">What Makes This Different</p>
        <h2>This is not another business course.</h2>
        <p>Most business programs teach professionals how to grow. Most beauty trainings teach professionals how to perform. Power Within Professional™ teaches professionals how to guide, structure, and communicate transformation.</p>
        <p>This experience sits at the intersection of beauty, image, confidence, identity, personal presence, wellness-informed communication, client experience, coaching skills, professional standards, and self-leadership.</p>
        <strong>This is where beauty and image professionals learn to stop offering isolated services and start creating meaningful signature experiences.</strong>
      </section>

      <section className="professionals-work section-shell">
        <div>
          <p className="eyebrow">How It Works</p>
          <h2>A guided professional buildout, not another course to consume.</h2>
          <p>The work is designed for professionals ready to elevate their client experience with clarity, structure, and guided implementation.</p>
          <div>
            {workItems.map((item) => (
              <article key={item}><span aria-hidden="true" /><p>{item}</p></article>
            ))}
          </div>
        </div>
        <img src={professionalConsultationImage} alt="Professional consultation with a client in a calm refined studio" />
      </section>

      <section className="professionals-wellness section-shell">
        <article>
          <p className="eyebrow">Wellness-Informed Approach</p>
          <h2>A wellness-informed approach that honors the whole woman.</h2>
          <p>Kim brings a wellness-informed approach to beauty, image, and personal presence, helping professionals understand that confidence is influenced not only by how a woman looks, but by how she feels, lives, leads, and reconnects with herself.</p>
        </article>
        <article>
          <h3>Clear professional scope</h3>
          <p>This program does not train professionals to diagnose, treat, prescribe, or advise medically. Instead, it helps them ask better questions, listen more deeply, and create a client experience that honors the whole woman while staying within professional scope.</p>
        </article>
        <article>
          <h3>Pattern reset and self-trust</h3>
          <p>Participants are guided through mindset and pattern-reset work to strengthen confidence, boundaries, pricing, visibility, follow-through, and professional self-trust.</p>
        </article>
      </section>

      <section className="professionals-closing section-shell">
        <p className="eyebrow">Not For Everyone</p>
        <h2>For the professional ready to grow in depth, identity, standards, and client transformation.</h2>
        <p>Power Within Professional™ is not for professionals looking for quick marketing tricks, discount strategies, or another list of services to add to an already full menu.</p>
        <p>The future of beauty is not just service. It is transformation. And the professional who understands that will be the one women trust with more than the appointment.</p>
        <Link className="button button-primary" to="/contact?interest=professionals">Book a Professional Signature Experience Call</Link>
      </section>
    </main>
  )
}

export default Professionals
