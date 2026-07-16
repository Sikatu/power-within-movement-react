export function getLetterBlockTitle(block) {
  const labels = {
    heading: 'Heading',
    text: 'Text',
    image: 'Image',
    button: 'Button',
    divider: 'Divider',
    spacer: 'Spacer',
    two_column: 'Two columns',
    quote: 'Quote',
    signature: 'Signature',
    social_links: 'Social links',
    video_preview: 'Video preview',
    resource: 'Resource',
    greeting: 'Personalized greeting',
    footer: 'Footer',
    unsubscribe: 'Required unsubscribe',
  }

  return labels[block?.type] || 'Content block'
}
