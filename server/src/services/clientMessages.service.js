const CLIENT_MESSAGE_TYPES = ['encouragement', 'announcement']

function normalizeClientMessageType(value) {
  return CLIENT_MESSAGE_TYPES.includes(value) ? value : 'encouragement'
}

function getClientMessageLanguage(value) {
  const messageType = normalizeClientMessageType(value)

  if (messageType === 'announcement') {
    return {
      messageType,
      singular: 'announcement',
      title: 'A new portal announcement is ready',
      actionLabel: 'Read Announcement',
      importance: 'high',
    }
  }

  return {
    messageType,
    singular: 'encouragement',
    title: 'A new encouragement is waiting',
    actionLabel: 'Read Encouragement',
    importance: 'normal',
  }
}

module.exports = {
  CLIENT_MESSAGE_TYPES,
  getClientMessageLanguage,
  normalizeClientMessageType,
}
