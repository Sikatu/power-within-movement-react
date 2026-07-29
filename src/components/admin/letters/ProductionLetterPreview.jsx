export default function ProductionLetterPreview({ mode, preview, loading, error }) {
  if (mode === 'plain') {
    return (
      <section className="pwc-letters28-plain-preview" aria-label="Plain-text email preview">
        <header><strong>Plain-text preview</strong><span>Used when HTML is unavailable</span></header>
        <pre>{loading ? 'Rendering preview…' : error || preview?.text || 'Start writing to see the plain-text version.'}</pre>
      </section>
    )
  }

  return (
    <section className={`pwc-letters28-production-preview is-${mode}`} aria-label={`${mode} production email preview`} aria-busy={loading}>
      <header><strong>{mode === 'mobile' ? 'Mobile' : 'Desktop'} production preview</strong><span>{loading ? 'Rendering…' : 'Exact delivery HTML'}</span></header>
      {error
        ? <div className="pwc-letters28-preview-error" role="alert">{error}</div>
        : <iframe title={`${mode} rendered letter`} sandbox="" srcDoc={preview?.html || '<p style="font-family:sans-serif;padding:24px">Rendering preview…</p>'} />}
    </section>
  )
}
