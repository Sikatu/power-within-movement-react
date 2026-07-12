const app = require('./app')
const { env } = require('./config/env')
const { startNotificationEmailDispatcher } = require('./services/notificationCenter.service')
const { startAutomationDispatcher } = require('./services/automationStudio.service')
const { startBookingCommunicationDispatcher } = require('./services/bookingOnboarding.service')

app.listen(env.port, () => {
  console.log(`Power Within Native Backend running on http://localhost:${env.port}`)
  startNotificationEmailDispatcher()
  startAutomationDispatcher()
  startBookingCommunicationDispatcher()
})