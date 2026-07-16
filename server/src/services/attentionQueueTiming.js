function dueBucket(task, now = Date.now()) {
  if (!task?.dueAt) return 'unscheduled'

  const due = new Date(task.dueAt)
  if (Number.isNaN(due.getTime())) return 'unscheduled'

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

  const endOfWeek = new Date(startOfToday)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  if (due < startOfToday) return 'overdue'
  if (due < startOfTomorrow) return 'today'
  if (due < endOfWeek) return 'this_week'
  return 'later'
}

module.exports = { dueBucket }
