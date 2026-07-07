function FAQ() {
  const faqs = [
    {
      question: 'Where do I begin?',
      answer: 'Begin with a Power Shift Clarity Session. It is a calm, whole-person conversation designed to name what has shifted and clarify the next aligned step.',
    },
    {
      question: 'Is this a makeover?',
      answer: 'No. Radiance Reclaimed is not about becoming someone else. It is about helping your outer expression catch up with who you are now.',
    },
    {
      question: 'Who is this work for?',
      answer: 'This work is for women in a new season who want to feel current, clear, visible, and at home within themselves without chasing youth or performing confidence.',
    },
    {
      question: 'Do you work with professionals?',
      answer: 'Yes. Power Within Collective supports beauty, wellness, image, and coaching professionals who want to create deeper, more personal client experiences.',
    },
  ]

  return (
    <section className="section faq-section">
      <div className="section-header">
        <p className="eyebrow">FAQ</p>
        <h2>Questions before you begin.</h2>
      </div>

      <div className="faq-list">
        {faqs.map((faq) => (
          <article className="faq-item" key={faq.question}>
            <h3>{faq.question}</h3>
            <p>{faq.answer}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default FAQ

