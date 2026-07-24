import AssetVaultPicker from './AssetVaultPicker.jsx'
import { getLetterBlockTitle } from './letterBuilderBlocks.js'

function Field({ label, children, wide = false }) {
  return <label className={wide ? 'is-wide' : ''}><span>{label}</span>{children}</label>
}

const FONT_OPTIONS = [
  ['', 'Use global font'],
  ['Georgia, serif', 'Georgia'],
  ["'Times New Roman', serif", 'Times New Roman'],
  ["'Palatino Linotype', Palatino, Georgia, serif", 'Palatino'],
  ['Arial, sans-serif', 'Arial'],
  ['Helvetica, Arial, sans-serif', 'Helvetica'],
  ["'Trebuchet MS', Arial, sans-serif", 'Trebuchet'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['Tahoma, Geneva, sans-serif', 'Tahoma'],
]

export default function LetterBlockSettings({ block, onChange, onDuplicate, onDelete }) {
  if (!block) {
    return <div className="pwc-letters28-settings-empty"><strong>Select a content block</strong><p>Block-specific typography, content, spacing, links, and Asset Vault choices will appear here.</p></div>
  }

  const content = block.content || {}
  const settings = block.settings || {}
  const changeContent = (key, value) => onChange?.({ ...block, content: { ...content, [key]: value } })
  const changeSetting = (key, value) => onChange?.({ ...block, settings: { ...settings, [key]: value } })

  return (
    <div className="pwc-letters28-settings">
      <header><div><p className="admin-eyebrow">Selected Block</p><h2>{getLetterBlockTitle(block)}</h2></div><span>{block.type === 'unsubscribe' ? 'Required' : 'Editable'}</span></header>
      <div className="pwc-letters28-settings-fields">
        {['heading', 'text', 'greeting', 'quote', 'footer', 'unsubscribe'].includes(block.type) && (
          <Field label="Text" wide><textarea rows="5" value={content.text || ''} onChange={(event) => changeContent('text', event.target.value)} /></Field>
        )}
        {block.type === 'heading' && <Field label="Heading level"><select value={content.level || 2} onChange={(event) => changeContent('level', Number(event.target.value))}><option value="1">Primary</option><option value="2">Section</option><option value="3">Small</option></select></Field>}
        {block.type === 'quote' && <Field label="Attribution"><input value={content.attribution || ''} onChange={(event) => changeContent('attribution', event.target.value)} /></Field>}
        {block.type === 'button' && <><Field label="Button label"><input value={content.text || ''} onChange={(event) => changeContent('text', event.target.value)} /></Field><Field label="Destination URL" wide><input type="url" value={content.url || ''} onChange={(event) => changeContent('url', event.target.value)} /></Field></>}
        {block.type === 'image' && <><AssetVaultPicker value={content.assetId || ''} onChange={(assetId) => changeContent('assetId', assetId)} label="Choose newsletter image" type="image/" accept="image/*" allowUpload /><Field label="Alternative text"><input value={content.alt || ''} onChange={(event) => changeContent('alt', event.target.value)} required={Boolean(content.assetId)} /></Field><Field label="Caption"><input value={content.caption || ''} onChange={(event) => changeContent('caption', event.target.value)} /></Field><Field label="Image width"><input type="range" min="20" max="100" value={settings.width || 100} onChange={(event) => changeSetting('width', Number(event.target.value))} /><small>{settings.width || 100}%</small></Field><Field label="Image display"><select value={settings.imageFit || 'natural'} onChange={(event) => changeSetting('imageFit', event.target.value)}><option value="natural">Show full image</option><option value="crop">Crop to frame</option></select></Field>{settings.imageFit === 'crop' && <><Field label="Frame height"><input type="range" min="120" max="520" step="10" value={settings.cropHeight || 280} onChange={(event) => changeSetting('cropHeight', Number(event.target.value))} /><small>{settings.cropHeight || 280}px</small></Field><Field label="Horizontal focus"><input type="range" min="0" max="100" value={settings.positionX ?? 50} onChange={(event) => changeSetting('positionX', Number(event.target.value))} /><small>{settings.positionX ?? 50}%</small></Field><Field label="Vertical focus"><input type="range" min="0" max="100" value={settings.positionY ?? 50} onChange={(event) => changeSetting('positionY', Number(event.target.value))} /><small>{settings.positionY ?? 50}%</small></Field><Field label="Zoom"><input type="range" min="100" max="200" step="5" value={settings.zoom || 100} onChange={(event) => changeSetting('zoom', Number(event.target.value))} /><small>{settings.zoom || 100}%</small></Field><div className="pwc-letters28-image-presets is-wide" aria-label="Image alignment presets">{[[0, 0, 'Top left'], [50, 0, 'Top'], [100, 0, 'Top right'], [0, 50, 'Left'], [50, 50, 'Center'], [100, 50, 'Right'], [0, 100, 'Bottom left'], [50, 100, 'Bottom'], [100, 100, 'Bottom right']].map(([positionX, positionY, label]) => <button key={label} type="button" onClick={() => onChange?.({ ...block, settings: { ...settings, positionX, positionY } })}>{label}</button>)}</div><button type="button" className="is-text" onClick={() => onChange?.({ ...block, settings: { ...settings, imageFit: 'natural', cropHeight: 280, positionX: 50, positionY: 50, zoom: 100 } })}>Reset image position</button></>}</>}
        {block.type === 'two_column' && <><Field label="Left column" wide><textarea rows="4" value={content.left || ''} onChange={(event) => changeContent('left', event.target.value)} /></Field><Field label="Right column" wide><textarea rows="4" value={content.right || ''} onChange={(event) => changeContent('right', event.target.value)} /></Field></>}
        {block.type === 'signature' && <><Field label="Name"><input value={content.name || ''} onChange={(event) => changeContent('name', event.target.value)} /></Field><Field label="Title"><input value={content.title || ''} onChange={(event) => changeContent('title', event.target.value)} /></Field></>}
        {block.type === 'social_links' && Object.keys({ website: '', instagram: '', facebook: '', youtube: '' }).map((network) => <Field key={network} label={`${network[0].toUpperCase()}${network.slice(1)} URL`} wide><input type="url" value={content[network] || ''} onChange={(event) => changeContent(network, event.target.value)} /></Field>)}
        {block.type === 'video_preview' && <><AssetVaultPicker value={content.assetId || ''} onChange={(assetId) => changeContent('assetId', assetId)} label="Choose optional video preview image" type="image/" accept="image/*" allowUpload /><Field label="Video title"><input value={content.title || ''} onChange={(event) => changeContent('title', event.target.value)} /></Field><Field label="Video URL" wide><input type="url" value={content.url || ''} onChange={(event) => changeContent('url', event.target.value)} /></Field></>}
        {block.type === 'resource' && <><AssetVaultPicker value={content.assetId || ''} onChange={(assetId) => changeContent('assetId', assetId)} label="Choose downloadable resource" allowUpload /><Field label="Resource title"><input value={content.title || ''} onChange={(event) => changeContent('title', event.target.value)} /></Field><Field label="Description" wide><textarea rows="3" value={content.description || ''} onChange={(event) => changeContent('description', event.target.value)} /></Field></>}
        {block.type === 'divider' && <Field label="Divider color"><input type="color" value={settings.color || '#dfcdbf'} onChange={(event) => changeSetting('color', event.target.value)} /></Field>}
        {block.type === 'spacer' && <Field label="Spacer height"><input type="range" min="4" max="160" value={settings.height || 32} onChange={(event) => changeSetting('height', Number(event.target.value))} /><small>{settings.height || 32}px</small></Field>}

        {!['spacer'].includes(block.type) && <>
          <Field label="Alignment"><select value={settings.align || 'left'} onChange={(event) => changeSetting('align', event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></Field>
          {['heading', 'text', 'greeting', 'quote', 'signature', 'footer', 'unsubscribe'].includes(block.type) && <Field label="Font"><select value={settings.fontFamily || ''} onChange={(event) => changeSetting('fontFamily', event.target.value)}>{FONT_OPTIONS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}</select></Field>}
          <Field label="Section padding"><input type="range" min="0" max="80" value={settings.padding ?? 16} onChange={(event) => changeSetting('padding', Number(event.target.value))} /><small>{settings.padding ?? 16}px</small></Field>
          <Field label="Section background"><input type="color" value={settings.backgroundColor === 'transparent' ? '#fffdf9' : settings.backgroundColor || '#fffdf9'} onChange={(event) => changeSetting('backgroundColor', event.target.value)} /></Field>
          {settings.backgroundColor !== 'transparent' && <button type="button" className="is-text" onClick={() => changeSetting('backgroundColor', 'transparent')}>Clear background</button>}
        </>}
      </div>
      {block.type === 'greeting' && <p className="pwc-letters28-token-note">Personalization fields: {'{{firstName}}'}, {'{{lastName}}'}, and {'{{email}}'}.</p>}
      <footer>
        {block.type !== 'unsubscribe' && <><button type="button" onClick={() => onDuplicate?.(block.id)}>Duplicate</button><button type="button" className="is-danger" onClick={() => onDelete?.(block.id)}>Delete</button></>}
        {block.type === 'unsubscribe' && <p>The unsubscribe block cannot be deleted or duplicated.</p>}
      </footer>
    </div>
  )
}
