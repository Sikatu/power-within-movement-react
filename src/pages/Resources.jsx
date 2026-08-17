import { Link } from 'react-router-dom'
import conversationStartersImage from '../assets/images/100-conversation-starters.webp'
import vaultImage from '../assets/images/vault-reflection-journal.webp'
import { resourceArticleSummaries } from '../data/resourceArticles.js'
import { publicLinks } from '../config/publicLinks.js'
import './Resources.css'

const featuredArticle =
  resourceArticleSummaries.find(
    (article) =>
      article.slug === 'rebuild-confidence-through-personal-style',
  ) ?? resourceArticleSummaries[0]

const supportingArticles =
  resourceArticleSummaries.filter(
    (article) => article.slug !== featuredArticle.slug,
  )

function Resources() {
  return (
    <main id="main-content" className="resources-page">
      <section className="resources-hero">
        <div className="section-shell resources-hero-grid">
          <div className="resources-hero-copy">
            <p className="eyebrow">Resources</p>

            <h1>The Vault&trade;</h1>

            <p className="resources-hero-thesis">
              Not more content.
              <span> More substance.</span>
            </p>

            <p className="resources-hero-lead">
              A public collection of thoughtful resources for
              confidence, color, style, reflection, and Personal
              Presence&trade;. Created to be useful in the chapter
              you are actually living.
            </p>

            <div className="resources-hero-actions">
              <a
                className="button button-primary"
                href="#guides"
              >
                Browse the Guides
              </a>

              <a
                className="button button-text"
                href={publicLinks.conversationStarters}
                target="_blank"
                rel="noreferrer"
              >
                Get 100 Conversation Starters
                <span aria-hidden="true"> &rarr;</span>
              </a>
            </div>

            <p className="resources-hero-note">
              Free tools. Editorial guides. The Power Within Edit.
            </p>
          </div>

          <div className="resources-hero-visual">
            <span aria-hidden="true" />

            <img
              src={vaultImage}
              alt="Reflection journal and thoughtful resources"
            />
          </div>
        </div>
      </section>

      <section
        id="100-conversation-starters"
        className="resources-free section-shell scroll-target"
      >
        <div className="resources-free-visual">
          <img
            src={conversationStartersImage}
            alt="100 Conversation Starters free resource"
          />
        </div>

        <div className="resources-free-copy">
          <p className="eyebrow">A Free Resource</p>

          <h2>100 Conversation Starters</h2>

          <p className="resources-free-lead">
            A thoughtful set of prompts created to open more
            meaningful conversations, reflection, connection,
            and curiosity.
          </p>

          <p>
            Use them with family, friends, a group, or simply as
            prompts for your own reflection when you want a better
            question than &ldquo;How are you?&rdquo;
          </p>

          <a
            className="button button-primary"
            href={publicLinks.conversationStarters}
            target="_blank"
            rel="noreferrer"
          >
            Get the Free Resource
          </a>
        </div>
      </section>

      <section className="resources-edit">
        <div className="section-shell resources-edit-grid">
          <div>
            <p className="eyebrow">Stay Connected</p>

            <h2>The Power Within Edit</h2>
          </div>

          <div className="resources-edit-copy">
            <p>
              Thoughtful notes on Personal Presence, color, beauty,
              style, confidence, self-expression, and choosing what
              comes next.
            </p>

            <a
              className="button resources-edit-button"
              href={publicLinks.newsletter}
              target="_blank"
              rel="noreferrer"
            >
              Join The Power Within Edit
            </a>
          </div>
        </div>
      </section>

      <section
        id="guides"
        className="resources-library section-shell scroll-target"
      >
        <header className="resources-library-heading">
          <p className="eyebrow">Guides &amp; Reflections</p>

          <h2>Read what is useful now.</h2>

          <p>
            These public guides turn common questions about color,
            style, confidence, and presence into clearer language
            and practical direction.
          </p>
        </header>

        <div className="resources-library-grid">
          <Link
            className="resources-featured-article"
            to={'/resources/' + featuredArticle.slug}
          >
            <div className="resources-featured-meta">
              <span>01</span>
              <p>{featuredArticle.category}</p>
            </div>

            <h3>{featuredArticle.title}</h3>

            <p>{featuredArticle.summary}</p>

            <strong>
              Read the Guide
              <span aria-hidden="true"> &rarr;</span>
            </strong>
          </Link>

          <div className="resources-article-list">
            {supportingArticles.map((article, index) => (
              <Link
                to={'/resources/' + article.slug}
                key={article.slug}
              >
                <span>
                  {String(index + 2).padStart(2, '0')}
                </span>

                <div>
                  <p>{article.category}</p>
                  <h3>{article.title}</h3>
                  <small>{article.summary}</small>
                </div>

                <strong aria-hidden="true">&rarr;</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="resources-definition">
        <div className="section-shell resources-definition-grid">
          <div>
            <p className="eyebrow">Why The Vault&trade; Exists</p>

            <h2>A quieter place for clarity and reflection.</h2>
          </div>

          <div>
            <p>
              There is already more information available than most
              people can use. The purpose of The Vault is not to add
              noise. It is to gather useful ideas and tools that can
              help a woman think more clearly about the life, body,
              choices, and chapter she is actually in.
            </p>

            <p>
              Come for one useful question. Return when another one
              becomes relevant.
            </p>
          </div>
        </div>
      </section>

      <section className="resources-next">
        <div className="section-shell resources-next-inner">
          <p className="eyebrow">When You Want It to Be Personal</p>

          <h2>
            A resource can clarify the question.
            Personal guidance can help you work with the answer.
          </h2>

          <p>
            Explore one-to-one Personal Presence guidance when the
            question becomes specific to your color, beauty, wardrobe,
            confidence, or the chapter you are navigating.
          </p>

          <div className="resources-next-actions">
            <Link
              className="button button-primary"
              to="/experiences"
            >
              Explore Personal Presence
            </Link>

            <Link
              className="button button-secondary"
              to="/radiance-reclaimed"
            >
              Explore Radiance Reclaimed&trade;
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Resources
