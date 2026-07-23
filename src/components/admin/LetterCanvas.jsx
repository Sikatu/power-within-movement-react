import { getLetterBlockTitle } from './letterBuilderBlocks.js'
import { getAssetVaultPreviewUrl } from '../../lib/nativeApi.js'

function EditableText({ value, fallback, className, onChange, multiline = true }) {
  return <span
    className={className}
    contentEditable
    suppressContentEditableWarning
    role="textbox"
    aria-multiline={multiline}
    tabIndex="0"
    onPaste={(event) => {
      event.preventDefault()
      const text = event.clipboardData.getData('text/plain').replace(/\r\n/g, '\n')
      document.execCommand('insertText', false, text)
    }}
    onBlur={(event) => onChange(event.currentTarget.innerText.replace(/\u00a0/g, ' ').trim())}
  >{value || fallback}</span>
}

function BlockPreview({ block, settings, readOnly, onChange }) {
  const content = block.content || {}
  const style = {
    padding: `${block.settings?.padding ?? 16}px`,
    textAlign: block.settings?.align || 'left',
    background: block.settings?.backgroundColor || 'transparent',
    color: settings.textColor,
  }

  if (block.type === 'heading') {
    const Tag = `h${Math.min(3, Math.max(1, Number(content.level || 2)))}`
    return <div style={style}><Tag>{readOnly ? content.text || 'Untitled heading' : <EditableText value={content.text} fallback="Untitled heading" onChange={(text) => onChange('text', text)} />}</Tag></div>
  }
  if (block.type === 'text' || block.type === 'greeting') {
    return <div style={style}><p className={block.type === 'greeting' ? 'is-greeting' : ''}>{readOnly ? content.text || 'Write your message here.' : <EditableText value={content.text} fallback="Write your message here." onChange={(text) => onChange('text', text)} />}</p></div>
  }
  if (block.type === 'image') {
    return <div style={style}>{content.assetId ? <img className="pwc-letters28-canvas-image" src={getAssetVaultPreviewUrl(content.assetId)} alt={content.alt || ''} style={{ width: `${block.settings?.width || 100}%` }} /> : <div className="pwc-letters28-asset-placeholder"><span>Image</span><strong>Choose an Asset Vault image</strong><small>Add alternative text</small></div>}{content.caption && <p className="is-caption">{content.caption}</p>}</div>
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

export default function LetterCanvas({ design, selectedBlockId, onSelect, onMove, onChangeBlock, onDuplicate, onDelete, onInsert, previewMode = 'edit', readOnly = false }) {
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
        {blocks.map((block, index) => (
          <div className="pwc-letters28-block-wrap" key={block.id}>
          {!readOnly && <button type="button" className="pwc-letters28-insert-control" aria-label={`Insert text before ${getLetterBlockTitle(block)}`} onClick={() => onInsert?.(index, 'text')}>+ Insert</button>}
          <article
            className={`${selectedBlockId === block.id ? 'is-selected' : ''}${block.type === 'unsubscribe' ? ' is-required' : ''}`}
            draggable={!readOnly && block.type !== 'unsubscribe'}
            onDragStart={(event) => event.dataTransfer.setData('text/pwc-letter-block', block.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropBlock(event, block.id)}
            onClick={() => onSelect?.(block.id)}
            onKeyDown={(event) => {
              if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
              event.preventDefault()
              const target = blocks[index + (event.key === 'ArrowUp' ? -1 : 1)]
              if (target) onMove?.(block.id, target.id)
            }}
            tabIndex="0"
          >
            <span className="pwc-letters28-block-label">{getLetterBlockTitle(block)}</span>
            {selectedBlockId === block.id && block.type !== 'unsubscribe' && !readOnly && <div className="pwc-letters28-selection-toolbar" aria-label="Selected block actions"><button type="button" onClick={(event) => { event.stopPropagation(); if (index > 0) onMove?.(block.id, blocks[index - 1].id) }}>↑</button><button type="button" onClick={(event) => { event.stopPropagation(); if (index < blocks.length - 2) onMove?.(blocks[index + 1].id, block.id) }}>↓</button><button type="button" onClick={(event) => { event.stopPropagation(); onDuplicate?.(block.id) }}>Duplicate</button><button type="button" onClick={(event) => { event.stopPropagation(); onDelete?.(block.id) }}>Delete</button></div>}
            <BlockPreview block={block} settings={settings} readOnly={readOnly} onChange={(key, value) => onChangeBlock?.({ ...block, content: { ...(block.content || {}), [key]: value } })} />
          </article>
          </div>
        ))}
      </div>
    </div>
  )
}
