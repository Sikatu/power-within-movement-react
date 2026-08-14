import { Link } from 'react-router-dom'
import './FAQ.css'

const faqs = [
  {
    question: 'Where do I begin?',
    answer: 'Begin with a calm conversation. You do not need to know which experience is right for you before reaching out. Share what has shifted, what feels unclear, and what kind of support you are looking for.',
  },
  {
    question: 'Is this a makeover?',
    answer: 'No. Power Within Collective is not about becoming someone else. The work is designed to help your outer expression, confidence, and personal presence feel more aligned with who you are now.',
  },
  {
    question: 'Who is this work for?',
    answer: 'This work is for women in a new season who want to feel current, clear, visible, and at home within themselves without chasing youth or performing confidence.',
  },
  {
    question: 'Do you work with professionals?',
    answer: 'Yes. Power Within Collective supports beauty, wellness, image, and coaching professionals who want to create deeper and more personal client experiences.',
  },
  {
    question: 'What if I am not sure which experience fits?',
    answer: 'That is completely fine. The first conversation is there to create clarity. You can begin with what you are experiencing rather than trying to choose the perfect service on your own.',
  },
  {
    question: 'How do I contact Power Within Collective?',
    answer: 'Use the Contact page to begin. From there, you will be guided to the private Power Within Collective contact form.',
  },
]

function FAQ() {
  return (
    <main id="main-content" className="faq-page">
      <section className="faq-hero section-shell">
        <p className="eyebrow">Frequently Asked Questions</p>
        <h1>Questions before you begin.</h1>
        <p>
          A thoughtful place to understand the work, the experience,
          and what your next step can look like.
        </p>
      </section>

      <section className="faq-content section-shell">
        <div className="faq-page-list">
          {faqs.map((faq, index) => (
            <article key={faq.question}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{faq.question}</h2>
                <p>{faq.answer}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="faq-closing section-shell">
        <p className="eyebrow">Still Wondering?</p>
        <h2>You do not need every answer before you reach out.</h2>
        <p>
          Begin with a conversation. Power Within can help you understand
          what kind of support fits the season you are in.
        </p>
        <Link className="button button-primary" to="/contact">
          Get in Touch
        </Link>
      </section>
    </main>
  )
}

export default FAQ