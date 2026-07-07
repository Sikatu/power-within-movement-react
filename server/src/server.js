const app = require('./app')
const { env } = require('./config/env')

app.listen(env.port, () => {
  console.log(`Power Within Native Backend running on http://localhost:${env.port}`)
})