import { Link, Navigate, useParams } from 'react-router-dom'
import { resourceArticles } from '../data/resourceArticles.js'
import './Resources.css'

function ResourceArticle() {
  const { slug } = useParams()
  const article = resourceArticles[slug]

  if (!article) return <Navigate to="/resources" replace />

  return (
    <main id="main-content" className="resource-article-page">
      <header className="resource-article-hero section-shell">
        <Link to="/resources">← Return to The Vault</Link>
        <p className="eyebrow">{article.eyebrow}</p>
        <h1>{article.title}</h1>
        <p>{article.description}</p>
      </header>

      <article className="resource-article-body section-shell">
        {article.sections.map((section, index) => (
          <section key={section.heading}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
      </article>

      <section className="resource-article-next section-shell">
        <p className="eyebrow">A Thoughtful Next Step</p>
        <h2>Ready for more personal guidance?</h2>
        <p>These resources are a place to begin. If you want support that is more specific to your colors, style, confidence, presence, or season of life, Power Within Collective offers private experiences designed to help you move with clarity.</p>
        <div>
          <Link className="button vault-gold-button" to={article.ctaPath}>{article.cta}</Link>
          <Link className="button vault-dark-outline" to="/contact">Start the Conversation</Link>
        </div>
      </section>
    </main>
  )
}

export default ResourceArticle
