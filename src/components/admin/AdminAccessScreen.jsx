export default function AdminAccessScreen({ eyebrow, title, message, children }) {
  return (
    <main className="pwc-admin-auth-screen" aria-live="polite" aria-busy={!children}>
      <section className="pwc-admin-auth-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {children}
      </section>
    </main>
  )
}
