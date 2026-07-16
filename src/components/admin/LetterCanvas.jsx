import { getLetterBlockTitle } from './letterBuilderBlocks.js'

function BlockPreview({ block, settings }) {
  const content = block.content || {}
  const style = {
    padding: `${block.settings?.padding ?? 16}px`,
    textAlign: block.settings?.align || 'left',
    background: block.settings?.backgroundColor || 'transparent',
    color: settings.textColor,
  }

  if (block.type === 'heading') {
    const Tag = `h${Math.min(3, Math.max(1, Number(content.level || 2)))}`
    return <div style={style}><Tag>{content.text || 'Untitled heading'}</Tag></div>
  }
  if (block.type === 'text' || block.type === 'greeting') {
    return <div style={style}><p className={block.type === 'greeting' ? 'is-greeting' : ''}>{content.text || 'Write your message here.'}</p></div>
  }
  if (block.type === 'image') {
    return <div style={style}><div className="pwc-letters28-asset-placeholder"><span>Image</span><strong>{content.assetId ? 'Asset Vault image selected' : 'Choose an Asset Vault image'}</strong><small>{content.alt || 'Add alternative text'}</small></div>{content.caption && <p className="is-caption">{content.caption}</p>}</div>
  }
  if (block.type === 'button') {
    return <div style={style}><span className="pwc-letters28-preview-button" style={{ background: settings.accentColor }}>{content.text || 'Button label'}</span></div>
  }
  if (block.type === 'divider') {
    return <div style={style}><hr style={{ borderColor: block.settings?.color || '#dfcdbf' }} /></div>
  }
  if (block.type === 'spacer') {
    return <div className="pwc-letters28-spacer" style={{ height: `${block.settings?.height || 32}px` }}><span>{block.settings?.height || 32}px</span></div>
  }
  if (block.type === 'two_column') {
    return <div style={style} className="pwc-letters28-two-column"><p>{content.left || 'Left column'}</p><p>{content.right || 'Right column'}</p></div>
  }
  if (block.type === 'quote') {
    return <div style={style}><blockquote>“{content.text || 'A meaningful reflection.'}”</blockquote>{content.attribution && <cite>{content.attribution}</cite>}</div>
  }
  if (block.type === 'signature') {
    return <div style={style} className="pwc-letters28-signature"><strong>{content.name || 'Kim Mittelstadt'}</strong><span>{content.title || 'Power Within Collective'}</span></div>
  }
  if (block.type === 'social_links') {
    const active = Object.entries(content).filter(([, value]) => value)
    return <div style={style} className="pwc-letters28-socials">{active.length ? active.map(([name]) => <span key={name}>{name}</span>) : <span>Add social links</span>}</div>
  }
  if (block.type === 'video_preview') {
    return <div style={style}><div className="pwc-letters28-video"><span>▶</span><strong>{content.title || 'Watch this reflection'}</strong><small>{content.assetId ? 'Preview asset selected' : 'Optional preview image'}</small></div></div>
  }
  if (block.type === 'resource') {
    return <div style={style}><div className="pwc-letters28-resource"><span>↓</span><div><strong>{content.title || 'Download your resource'}</strong><small>{content.description || (content.assetId ? 'Asset Vault resource selected' : 'Choose an Asset Vault resource')}</small></div></div></div>
  }
  if (block.type === 'footer') {
    return <div style={style}><p className="is-footer">{content.text || 'Power Within Collective'}</p></div>
  }
  if (block.type === 'unsubscribe') {
    return <div style={style} className="pwc-letters28-unsubscribe"><u>{content.text || 'Unsubscribe from these letters'}</u><small>Required delivery protection</small></div>
  }
  return null
}

export default function LetterCanvas({ design, selectedBlockId, onSelect, onMove, previewMode = 'desktop', readOnly = false }) {
  const settings = design?.settings || {}
  const blocks = design?.blocks || []

  function dropBlock(event, targetId) {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/pwc-letter-block')
    if (sourceId && sourceId !== targetId) onMove?.(sourceId, targetId)
  }

  return (
    <div className={`pwc-letters28-canvas-shell is-${previewMode}`} style={{ background: settings.backgroundColor }}>
      <div className="pwc-letters28-inbox-preview">
        <span>{previewMode === 'mobile' ? 'Mobile preview' : 'Desktop preview'}</span>
        <strong>Power Within Collective</strong>
      </div>
      <div className="pwc-letters28-canvas" style={{ background: settings.contentColor, color: settings.textColor, maxWidth: `${settings.contentWidth || 640}px`, fontFamily: settings.bodyFontFamily }}>
        {blocks.map((block) => (
          <article
            key={block.id}
            className={`${selectedBlockId === block.id ? 'is-selected' : ''}${block.type === 'unsubscribe' ? ' is-required' : ''}`}
            draggable={!readOnly && block.type !== 'unsubscribe'}
            onDragStart={(event) => event.dataTransfer.setData('text/pwc-letter-block', block.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropBlock(event, block.id)}
            onClick={() => onSelect?.(block.id)}
          >
            <span className="pwc-letters28-block-label">{getLetterBlockTitle(block)}</span>
            <BlockPreview block={block} settings={settings} />
          </article>
        ))}
      </div>
    </div>
  )
}
