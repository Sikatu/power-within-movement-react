import PageHero from '../components/PageHero'
import ContactCTA from '../components/ContactCTA'
import teenImage from '../assets/images/teen-confidence-conversation.webp'

function TeenPrograms() {
  return (
    <main>
      <PageHero
        eyebrow="Teen Programs"
        title="Confidence she can grow into, not perform for."
        text="Support for teen girls, mothers, mentors, and families who want deeper conversations around identity, confidence, self-image, connection, and presence."
      />

      <section className="section teen-hero-section">
        <div className="teen-hero-grid">
          <div className="teen-image-card">
            <img loading="lazy" src={teenImage} alt="Teen confidence and mother daughter connection" />
          </div>

          <div className="teen-hero-copy">
            <p className="eyebrow">For the Girl Becoming</p>
            <h2>She does not need more pressure. She needs steadier places to become herself.</h2>

            <p>
              The teen years can be full of comparison, performance, changing bodies, shifting
              friendships, social pressure, and questions she may not yet have words for.
            </p>

            <p>
              These programs are designed to help girls build confidence from the inside out,
              while helping mothers and mentors create better conversations around identity,
              beauty, wellness, style, and self-trust.
            </p>

            <div className="teen-trust-row">
              <article>
                <span>Identity</span>
                <strong>Rooted</strong>
              </article>

              <article>
                <span>Connection</span>
                <strong>Warmer</strong>
              </article>

              <article>
                <span>Confidence</span>
                <strong>Steadier</strong>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="section teen-belief-section">
        <div className="teen-belief-card">
          <p className="eyebrow">The Heart of the Work</p>
          <h2>Confidence is not taught by telling her to be confident.</h2>
          <p>
            Confidence is shaped through language, safety, self-recognition, embodiment, and the
            experience of being seen without being fixed. This work helps girls understand who they
            are, not just how they are being perceived.
          </p>
        </div>
      </section>

      <section className="section experiences teen-focus-section">
        <div className="section-header">
          <p className="eyebrow">What We Support</p>
          <h2>Grounded conversations for the moments that matter.</h2>
          <p>
            The work blends identity, emotional steadiness, self-image, beauty, wellness, style,
            and mother-daughter connection into one supportive experience.
          </p>
        </div>

        <div className="cards teen-focus-grid">
          <article className="card teen-focus-card">
            <span>01</span>
            <h3>Self-Image & Body Confidence</h3>
            <p>Helping her build a healthier relationship with her body, image, appearance, and expression.</p>
          </article>

          <article className="card teen-focus-card">
            <span>02</span>
            <h3>Identity & Self-Trust</h3>
            <p>Giving her language for who she is, what matters to her, and how she wants to show up.</p>
          </article>

          <article className="card teen-focus-card">
            <span>03</span>
            <h3>Mother-Daughter Connection</h3>
            <p>Creating warmer conversations that reduce pressure and build trust between generations.</p>
          </article>

          <article className="card teen-focus-card">
            <span>04</span>
            <h3>Presence, Style & Expression</h3>
            <p>Helping her use beauty and style as healthy self-expression, not performance or comparison.</p>
          </article>
        </div>
      </section>

      <section className="section teen-pathway-section">
        <div className="section-header">
          <p className="eyebrow">Ways to Begin</p>
          <h2>Choose the doorway that fits this season.</h2>
          <p>
            Start with a conversation, listen to the podcast, or explore a resource that opens the
            door to more honest connection.
          </p>
        </div>

        <div className="cards teen-pathway-grid">
          <article className="card teen-pathway-card">
            <span>01</span>
            <h3>Teen Confidence Support</h3>
            <p>For teen girls who need steadier language, confidence support, and a place to be seen clearly.</p>
            <a className="card-action-link" href="/contact?interest=teen">Start a conversation</a>
          </article>

          <article className="card teen-pathway-card">
            <span>02</span>
            <h3>Mother-Daughter Conversations</h3>
            <p>For mothers who want warmer, braver conversations without adding pressure or shame.</p>
            <a className="card-action-link" href="/resources#100-conversation-starters">Explore the resource</a>
          </article>

          <article className="card teen-pathway-card">
            <span>03</span>
            <h3>Raising Her Confidence Podcast</h3>
            <p>For ongoing conversations around confidence, connection, teen self-esteem, and identity.</p>
            <a className="card-action-link" href="/podcast">Listen to the podcast</a>
          </article>
        </div>
      </section>

      <section className="section teen-note-section">
        <div className="teen-note-card">
          <p className="eyebrow">For Mothers and Mentors</p>
          <h2>You do not have to have every answer. You can begin with better questions.</h2>
          <p>
            Sometimes the most meaningful shift begins with one conversation where she feels heard
            instead of corrected, supported instead of managed, and guided without being pushed.
          </p>
        </div>
      </section>

      <ContactCTA
        eyebrow="Begin Gently"
        title="Support her confidence with steadier conversations."
        text="Reach out to begin a conversation about teen confidence, mother-daughter connection, resources, or the next right support."
        actions={[
          { label: 'Ask About Teen Support', to: '/contact?interest=teen', variant: 'primary' },
          { label: 'Listen to the Podcast', to: '/podcast', variant: 'secondary' },
        ]}
      />
    </main>
  )
}

export default TeenPrograms