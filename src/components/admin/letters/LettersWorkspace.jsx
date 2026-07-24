import { Link } from 'react-router-dom'
import LetterBlockSettings from '../LetterBlockSettings.jsx'
import LetterCanvas from '../LetterCanvas.jsx'
import ProductionLetterPreview from './ProductionLetterPreview.jsx'

const workspaceTabs = [
  ['letters', 'Letters'],
  ['delivery', 'Delivery'],
  ['results', 'Results'],
]

export function LettersWorkspace({ audience, activeTab, scheduledCount, onTabChange, error, notice, children }) {
  return (
    <section className="pwc-letters28-page">
      <header className="pwc-letters28-hero">
        <div><p className="admin-eyebrow">Power Within Communications</p><h1>Letters &amp; Broadcasts</h1><p>Design thoughtful, branded letters and deliver them only to people whose current consent allows it.</p></div>
        <aside><span>Eligible audience</span><strong>{Number(audience.metrics?.eligible || 0).toLocaleString()}</strong><small>Phase 27 protections active</small></aside>
      </header>
      {error && <div className="pwc-letters28-alert is-error" role="alert">{error}</div>}
      {notice && <div className="pwc-letters28-alert is-success" role="status">{notice}</div>}
      <nav className="pwc-letters28-tabs pwc-phase35-primary-tabs" aria-label="Letters workspace sections">
        {workspaceTabs.map(([id, label]) => <button key={id} type="button" className={activeTab === id ? 'is-active' : ''} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onTabChange(id)}>{label}{id === 'delivery' && scheduledCount > 0 ? <span>{scheduledCount}</span> : null}</button>)}
      </nav>
      {children}
    </section>
  )
}

export function TemplateLibrary({ templates, formatStatus, formatDate, onUse }) {
  return (
    <section className="pwc-letters28-panel pwc-letters28-templates">
      <header><div><p className="admin-eyebrow">Templates</p><h2>Start from a reusable design</h2></div><span>{templates.length} active</span></header>
      <div>{templates.length ? templates.map((template) => <article key={template.id}><span>{formatStatus(template.category)}</span><h3>{template.name}</h3><p>{template.description || template.preview_text}</p><small>{template.design?.blocks?.length || 0} blocks · Updated {formatDate(template.updated_at)}</small><button type="button" onClick={() => onUse(template)}>Use template</button></article>) : <p className="pwc-letters28-empty">No reusable templates yet.</p>}</div>
    </section>
  )
}

export function LettersLibrary({ libraryMode, setLibraryMode, creatingLetter, setCreatingLetter, newLetter, setNewLetter, overview, loading, busy, onCreate, onOpen, onDuplicate, formatStatus, formatDate, onUseTemplate }) {
  const templates = overview.templates || []
  const letters = overview.letters || []
  return (
    <section className="pwc-phase35-letter-library">
      <header className="pwc-phase35-taskbar">
        <div><p className="admin-eyebrow">Letter Library</p><h2>{libraryMode === 'drafts' ? 'Draft and recent work' : 'Reusable designs'}</h2></div>
        <div className="pwc-phase35-taskbar__actions">
          <div className="pwc-phase35-view-switch" role="tablist" aria-label="Letter library view">
            <button type="button" role="tab" aria-selected={libraryMode === 'drafts'} className={libraryMode === 'drafts' ? 'is-active' : ''} onClick={() => setLibraryMode('drafts')}>Letters</button>
            <button type="button" role="tab" aria-selected={libraryMode === 'templates'} className={libraryMode === 'templates' ? 'is-active' : ''} onClick={() => setLibraryMode('templates')}>Templates</button>
          </div>
          <button type="button" className="pwc-phase35-primary-action" onClick={() => setCreatingLetter((current) => !current)}>{creatingLetter ? 'Close' : '+ New letter'}</button>
        </div>
      </header>
      {creatingLetter && <section className="pwc-letters28-panel pwc-letters28-new pwc-phase35-create-panel"><header><div><p className="admin-eyebrow">Create</p><h2>Begin a new letter</h2></div></header><form onSubmit={onCreate}><label><span>Internal letter title</span><input value={newLetter.title} onChange={(event) => setNewLetter((current) => ({ ...current, title: event.target.value }))} placeholder="July reflection for a new season" required /></label><label><span>Starting template</span><select value={newLetter.templateId} onChange={(event) => setNewLetter((current) => ({ ...current, templateId: event.target.value }))}><option value="">Clean Power Within letter</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><button type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Create letter'}</button></form></section>}
      {libraryMode === 'drafts'
        ? <section className="pwc-letters28-panel pwc-letters28-letter-list"><header><div><p className="admin-eyebrow">Letters</p><h2>Open a letter to continue</h2></div><span>{letters.length} letters</span></header><div>{loading ? <p className="pwc-letters28-empty">Loading letters…</p> : letters.length ? letters.map((letter) => <article key={letter.id}><button type="button" onClick={() => onOpen(letter.id)}><span className={`pwc-letters28-status is-${letter.status}`}>{formatStatus(letter.status)}</span><strong>{letter.title}</strong><p>{letter.subject || 'Subject not written yet'}</p><small>Revision {letter.autosave_revision} · {formatDate(letter.updated_at)}</small></button><button type="button" className="is-copy" onClick={() => onDuplicate(letter.id)}>Duplicate</button></article>) : <p className="pwc-letters28-empty">Create the first visual Power Within letter.</p>}</div></section>
        : <TemplateLibrary templates={templates} formatStatus={formatStatus} formatDate={formatDate} onUse={onUseTemplate} />}
    </section>
  )
}

export function BlockLibrary({ palette, working, readOnly, onAddBlock, onUpdateDesign }) {
  const settings = working.design.settings
  const changeSetting = (key, value) => onUpdateDesign({ ...working.design, settings: { ...settings, [key]: value } })
  return (
    <aside className="pwc-letters28-blocks">
      <header><p className="admin-eyebrow">Content Blocks</p><h2>Build your letter</h2></header>
      <div>{palette.map(([type, label, icon]) => <button type="button" key={type} onClick={() => onAddBlock(type)} disabled={readOnly}><span>{icon}</span><strong>{label}</strong></button>)}</div>
      <section><p className="admin-eyebrow">Global Style</p>
        {[['backgroundColor', 'Page color'], ['contentColor', 'Content color'], ['textColor', 'Text color'], ['accentColor', 'Accent color']].map(([key, label]) => <label key={key}><span>{label}</span><input type="color" value={settings[key]} onChange={(event) => changeSetting(key, event.target.value)} /></label>)}
        <label><span>Display type</span><select value={settings.fontFamily} onChange={(event) => changeSetting('fontFamily', event.target.value)}><option value="Georgia, serif">Georgia</option><option value="'Times New Roman', serif">Times New Roman</option></select></label>
        <label><span>Body type</span><select value={settings.bodyFontFamily} onChange={(event) => changeSetting('bodyFontFamily', event.target.value)}><option value="Arial, sans-serif">Arial</option><option value="Helvetica, Arial, sans-serif">Helvetica</option><option value="'Trebuchet MS', Arial, sans-serif">Trebuchet</option></select></label>
        <label><span>Content width</span><input type="range" min="420" max="760" step="20" value={settings.contentWidth || 640} onChange={(event) => changeSetting('contentWidth', Number(event.target.value))} /><small>{settings.contentWidth || 640}px</small></label>
        <label><span>Muted color</span><input type="color" value={settings.mutedColor || '#7f6f73'} onChange={(event) => changeSetting('mutedColor', event.target.value)} /></label>
      </section>
    </aside>
  )
}

export function BroadcastWizard({ flowStep, selectedBlock, onChangeBlock, onDuplicateBlock, onDeleteBlock, renderFlowPanel, versions, readOnly, busy, onRestoreVersion, templateName, setTemplateName, onSaveTemplate, formatStatus, formatDate }) {
  return (
    <aside className="pwc-letters28-right-panel">
      {flowStep === 'design' ? <LetterBlockSettings block={selectedBlock} onChange={onChangeBlock} onDuplicate={onDuplicateBlock} onDelete={onDeleteBlock} /> : renderFlowPanel()}
      {flowStep === 'design' && <><section className="pwc-letters28-version-box"><header><p className="admin-eyebrow">Draft Recovery</p><strong>{versions.length} versions</strong></header><div>{versions.slice(0, 6).map((version) => <button type="button" key={version.id} onClick={() => onRestoreVersion(version)} disabled={readOnly || busy === 'restore'}><span>Revision {version.revision}</span><small>{formatStatus(version.reason)} · {formatDate(version.created_at)}</small></button>)}</div></section><form className="pwc-letters28-template-save" onSubmit={onSaveTemplate}><label><span>Save as reusable template</span><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" /></label><button type="submit" disabled={!templateName.trim() || busy === 'template'}>Save template</button></form></>}
    </aside>
  )
}

export function LetterPropertiesPanel(props) {
  return <BroadcastWizard {...props} />
}

export function LetterEditor({ working, readOnly, saveState, undoCount, redoCount, previewMode, setPreviewMode, renderedPreview, previewLoading, previewError, flowStep, selectedBlockId, selectedBlock, versions, busy, templateName, setTemplateName, palette, onBack, onUpdateLetter, onUpdateDesign, onUndo, onRedo, onSave, onChooseRecipients, onAddBlock, onInsertBlock, onSelectBlock, onMoveBlock, onChangeBlock, onDuplicateBlock, onDeleteBlock, renderFlowPanel, onRestoreVersion, onSaveTemplate, formatStatus, formatDate }) {
  return (
    <section className="pwc-letters28-builder">
      <header className="pwc-letters28-topbar"><button type="button" className="is-back" onClick={onBack}>← Letters</button><div className="pwc-letters28-title-fields"><input aria-label="Internal letter title" value={working.title} onChange={(event) => onUpdateLetter({ title: event.target.value })} /><input aria-label="Email subject" value={working.subject || ''} onChange={(event) => onUpdateLetter({ subject: event.target.value })} placeholder="Email subject" /></div><div className="pwc-letters28-save-state"><span className={`is-${saveState}`}>{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save error' : 'Unsaved'}</span><small>Revision {working.autosave_revision}</small></div><div className="pwc-letters28-top-actions"><button type="button" onClick={onUndo} disabled={!undoCount || readOnly}>Undo</button><button type="button" onClick={onRedo} disabled={!redoCount || readOnly}>Redo</button><div aria-label="Preview mode"><button type="button" className={previewMode === 'edit' ? 'is-active' : ''} onClick={() => setPreviewMode('edit')}>Edit</button><button type="button" className={previewMode === 'desktop' ? 'is-active' : ''} onClick={() => setPreviewMode('desktop')}>Desktop</button><button type="button" className={previewMode === 'mobile' ? 'is-active' : ''} onClick={() => setPreviewMode('mobile')}>Mobile</button><button type="button" className={previewMode === 'plain' ? 'is-active' : ''} onClick={() => setPreviewMode('plain')}>Text</button></div><button type="button" onClick={onSave} disabled={readOnly}>Save now</button><button type="button" className="is-primary" onClick={onChooseRecipients} disabled={readOnly || !working.subject}>Choose recipients →</button></div></header>
      <div className="pwc-letters28-flow">{['design', 'recipients', 'review', 'test', 'send'].map((step, index) => <span key={step} className={flowStep === step ? 'is-active' : ''}>{index + 1} {step === 'send' ? 'Schedule or send' : step[0].toUpperCase() + step.slice(1)}</span>)}</div>
      <div className="pwc-letters28-builder-grid">
        <BlockLibrary palette={palette} working={working} readOnly={readOnly} onAddBlock={onAddBlock} onUpdateDesign={onUpdateDesign} />
        <main className="pwc-letters28-canvas-column"><label className="pwc-letters28-preview-text"><span>Inbox preview text</span><input value={working.preview_text || ''} onChange={(event) => onUpdateLetter({ preview_text: event.target.value })} placeholder="A short line shown beside the subject" /></label>{previewMode === 'edit' ? <LetterCanvas design={working.design} selectedBlockId={selectedBlockId} onSelect={onSelectBlock} onMove={onMoveBlock} onChangeBlock={onChangeBlock} onDuplicate={onDuplicateBlock} onDelete={onDeleteBlock} onInsert={onInsertBlock} previewMode={previewMode} readOnly={readOnly} /> : <ProductionLetterPreview mode={previewMode} preview={renderedPreview} loading={previewLoading} error={previewError} />}</main>
        <LetterPropertiesPanel flowStep={flowStep} selectedBlock={selectedBlock} onChangeBlock={onChangeBlock} onDuplicateBlock={onDuplicateBlock} onDeleteBlock={onDeleteBlock} renderFlowPanel={renderFlowPanel} versions={versions} readOnly={readOnly} busy={busy} onRestoreVersion={onRestoreVersion} templateName={templateName} setTemplateName={setTemplateName} onSaveTemplate={onSaveTemplate} formatStatus={formatStatus} formatDate={formatDate} />
      </div>
    </section>
  )
}

export function DeliveryQueue({ audience, deliveryView, setDeliveryView, scheduled, sent, adminUser, capabilities, busy, onProcessDue, renderBroadcastList }) {
  return <div className="pwc-phase35-delivery-stack"><section className="pwc-letters28-panel pwc-phase35-audience-ready"><div><p className="admin-eyebrow">Audience Readiness</p><h2>{Number(audience.metrics?.eligible || 0).toLocaleString()} eligible recipients</h2><p>Consent and suppression protections are checked again at send time.</p></div><Link to="/admin/audience">Manage audience →</Link></section><section className="pwc-letters28-panel pwc-letters28-broadcasts"><header><div><p className="admin-eyebrow">Delivery Queue</p><h2>{deliveryView === 'scheduled' ? 'Upcoming broadcasts' : 'Delivered letters'}</h2><p>Interrupted work recovers automatically. Safe retries send only to recipients whose prior attempt failed.</p></div><div className="pwc-phase35-taskbar__actions"><div className="pwc-phase35-view-switch" role="tablist" aria-label="Broadcast delivery view"><button type="button" role="tab" aria-selected={deliveryView === 'scheduled'} className={deliveryView === 'scheduled' ? 'is-active' : ''} onClick={() => setDeliveryView('scheduled')}>Scheduled {scheduled.length}</button><button type="button" role="tab" aria-selected={deliveryView === 'sent'} className={deliveryView === 'sent' ? 'is-active' : ''} onClick={() => setDeliveryView('sent')}>Sent {sent.length}</button></div>{deliveryView === 'scheduled' && adminUser?.role === 'developer' && capabilities?.recovery !== false && <button type="button" onClick={onProcessDue} disabled={busy === 'process-due'}>{busy === 'process-due' ? 'Checking…' : 'Run recovery check'}</button>}</div></header>{deliveryView === 'scheduled' ? renderBroadcastList(scheduled, 'No broadcasts are scheduled.', true) : renderBroadcastList(sent, 'No broadcasts have been sent yet.')}</section></div>
}

export function BroadcastAnalytics({ metrics, selectedBroadcast, compareBroadcast, sentBroadcasts, rate, formatStatus, exportUrl, renderBroadcastList, onCompareChange }) {
  const detail = selectedBroadcast?.broadcast
  const analytics = selectedBroadcast?.analytics || {}
  const delivered = Number(metrics.delivered || 0)
  const sent = Number(metrics.sent_to_provider || metrics.delivered_to_provider || 0)
  const metricRows = detail ? [
    ['Delivered', detail.delivered_count, compareBroadcast?.delivered_count],
    ['Open estimate', analytics.openRate === undefined ? rate(detail.opened_count, detail.delivered_count || detail.sent_count) : `${analytics.openRate}%`, compareBroadcast ? rate(compareBroadcast.opened_count, compareBroadcast.delivered_count || compareBroadcast.sent_count) : null],
    ['Click rate', analytics.clickRate === undefined ? rate(detail.clicked_count, detail.delivered_count || detail.sent_count) : `${analytics.clickRate}%`, compareBroadcast ? rate(compareBroadcast.clicked_count, compareBroadcast.delivered_count || compareBroadcast.sent_count) : null],
    ['Click-to-open', analytics.clickToOpenRate === undefined ? rate(detail.clicked_count, detail.opened_count) : `${analytics.clickToOpenRate}%`, compareBroadcast ? rate(compareBroadcast.clicked_count, compareBroadcast.opened_count) : null],
    ['Bounce rate', analytics.bounceRate === undefined ? rate(detail.bounced_count, detail.sent_count) : `${analytics.bounceRate}%`, compareBroadcast ? rate(compareBroadcast.bounced_count, compareBroadcast.sent_count) : null],
    ['Unsubscribe rate', analytics.unsubscribeRate === undefined ? rate(detail.unsubscribed_count, detail.delivered_count || detail.sent_count) : `${analytics.unsubscribeRate}%`, compareBroadcast ? rate(compareBroadcast.unsubscribed_count, compareBroadcast.delivered_count || compareBroadcast.sent_count) : null],
  ] : []

  return <section className="pwc-letters28-analytics">
    <div className="pwc-letters28-metrics">{[['Sent', sent], ['Delivered', delivered], ['Open estimate', rate(metrics.opened, delivered || sent)], ['Click rate', rate(metrics.clicked, delivered || sent)], ['Broadcasts', metrics.sent]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong></article>)}</div>
    <aside className="pwc-letters10-privacy-note" role="note"><strong>Open activity is an estimate.</strong><span>Mail privacy tools and image blocking can inflate or hide opens. Use clicks, replies, delivery, and unsubscribes as stronger decision signals.</span></aside>
    {selectedBroadcast ? <section className="pwc-letters28-panel pwc-letters28-results">
      <header><div><p className="admin-eyebrow">Broadcast Results</p><h2>{detail.title}</h2><p>{detail.subject}</p></div><div className="pwc-letters10-result-actions"><Link to={`/admin/inbox?search=${encodeURIComponent(detail.subject || detail.title)}`}>View replies in Inbox</Link><a href={exportUrl(detail.id)}>Export CSV</a></div></header>
      <div className="pwc-letters10-compare"><label><span>Compare with</span><select value={compareBroadcast?.id || ''} onChange={(event) => onCompareChange(event.target.value)}><option value="">No comparison</option>{sentBroadcasts.filter((item) => item.id !== detail.id).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>{compareBroadcast && <p>Comparison: <strong>{compareBroadcast.title}</strong></p>}</div>
      <div className="pwc-letters28-result-metrics">{metricRows.map(([label, value, comparison]) => <div key={label}><span>{label}</span><strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>{comparison !== null && comparison !== undefined && <small>{comparison} comparison</small>}</div>)}</div>
      <div className="pwc-letters28-results-grid"><section><h3>Per-link activity</h3>{selectedBroadcast.links.length ? selectedBroadcast.links.map((link) => <article key={link.id}><div><strong>{link.label || 'Tracked link'}</strong><small title={link.destination_url}>{link.destination_url}</small></div><span>{link.click_count} clicks · {link.unique_click_count} unique</span></article>) : <p>No tracked link activity yet.</p>}</section><section><h3>Subscriber delivery</h3>{selectedBroadcast.recipients.slice(0, 100).map((recipient) => <article key={recipient.id}><div><strong>{[recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || recipient.email}</strong><small>{recipient.email}</small></div><span className={`pwc-letters28-status is-${recipient.delivery_status}`}>{formatStatus(recipient.delivery_status)}</span></article>)}</section></div>
    </section> : <section className="pwc-letters28-panel pwc-letters28-analytics-list"><header><div><p className="admin-eyebrow">Results</p><h2>Choose a sent broadcast</h2></div></header>{renderBroadcastList(sentBroadcasts, 'Analytics will appear after the first broadcast.')}</section>}
  </section>
}
