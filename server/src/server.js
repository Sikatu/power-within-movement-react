const app = require('./app')
const { env } = require('./config/env')
const { startNotificationEmailDispatcher } = require('./services/notificationCenter.service')
const { startAutomationDispatcher } = require('./services/automationStudio.service')
const { startBookingCommunicationDispatcher } = require('./services/bookingOnboarding.service')
const { pool } = require('./db/pool')
const { startLetterBroadcastDispatcher } = require('./services/letterBroadcast.service')
const { startFounderTranscriptionDispatcher } = require('./services/founderTranscription.service')
const {
  installProcessErrorHandlers,
  startDeveloperErrorMonitor,
} = require('./services/developerErrorCenter.service')

installProcessErrorHandlers()

app.listen(env.port, () => {
  console.log(`Power Within Native Backend running on http://localhost:${env.port}`)
  startNotificationEmailDispatcher()
  startAutomationDispatcher()
  startBookingCommunicationDispatcher()
  startLetterBroadcastDispatcher(pool)
  startFounderTranscriptionDispatcher(pool)
  startDeveloperErrorMonitor()
})
