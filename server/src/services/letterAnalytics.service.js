function safeCount(value) {
  const count = Number(value || 0)
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0
}

function percentage(part, whole) {
  const denominator = safeCount(whole)
  if (!denominator) return 0
  return Number(((safeCount(part) / denominator) * 100).toFixed(1))
}

function buildLetterAnalytics(record = {}) {
  const sent = safeCount(record.sent_count)
  const delivered = safeCount(record.delivered_count)
  const denominator = delivered || sent
  const opened = safeCount(record.opened_count)
  const clicked = safeCount(record.clicked_count)

  return {
    sent,
    delivered,
    opened,
    clicked,
    deliveryRate: percentage(delivered, sent),
    openRate: percentage(opened, denominator),
    clickRate: percentage(clicked, denominator),
    clickToOpenRate: percentage(clicked, opened),
    bounceRate: percentage(record.bounced_count, sent),
    unsubscribeRate: percentage(record.unsubscribed_count, denominator),
    openTrackingIsEstimate: true,
  }
}

module.exports = { buildLetterAnalytics, percentage, safeCount }
