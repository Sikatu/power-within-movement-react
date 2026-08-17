import { Link, Navigate, useParams } from 'react-router-dom'
import { resourceArticles } from '../data/resourceArticles.js'
import './Resources.css'

function ResourceArticle() {
  const { slug } = useParams()
  const article = resourceArticles[slug]

  if (!article) {
    return <Navigate to="/resources" replace />
  }

  return (
    <main
      id="main-content"
      className="resource-article-page"
    >
      <header className="resource-article-hero">
        <div className="section-shell">
          <Link
            className="resource-article-back"
            to="/resources"
          >
            <span aria-hidden="true">&larr;</span>
            Return to Resources
          </Link>

          <p className="eyebrow">{article.eyebrow}</p>

          <h1>{article.title}</h1>

          <p>{article.description}</p>
        </div>
      </header>

      <article className="resource-article-body section-shell">
        {article.sections.map((section, index) => (
          <section key={section.heading}>
            <span>
              {String(index + 1).padStart(2, '0')}
            </span>

            <div>
              <h2>{section.heading}</h2>

              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </article>

      <section className="resource-article-next">
        <div className="section-shell resource-article-next-inner">
          <p className="eyebrow">
            When You Want It to Be Personal
          </p>

          <h2>
            Reading can clarify the question.
            Personal guidance can help you work with the answer.
          </h2>

          <p>
            If this topic feels relevant to your current chapter,
            explore the focused experience connected to it or begin
            with the wider Personal Presence pathway.
          </p>

          <div>
            <Link
              className="button resource-article-primary"
              to={article.ctaPath}
            >
              {article.cta}
            </Link>

            <Link
              className="button resource-article-secondary"
              to="/experiences"
            >
              Explore Personal Presence
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default ResourceArticle
