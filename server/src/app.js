const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')

const { env } = require('./config/env')
const healthRoutes = require('./routes/health.routes')
const systemRoutes = require('./routes/system.routes')
const authRoutes = require('./routes/auth.routes')
const adminRoutes = require('./routes/admin.routes')
const publicRoutes = require('./routes/public.routes')
const frontendErrorRoutes = require('./routes/frontendError.routes')
const developerErrorRoutes = require('./routes/developerErrors.routes')
const { requestErrorContext } = require('./middleware/errorMonitoring.middleware')
const { notFound, errorHandler } = require('./middleware/error.middleware')

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(helmet())

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS.`))
    },
    credentials: true,
  }),
)

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(requestErrorContext)
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))

app.get('/api', (req, res) => {
  res.json({
    ok: true,
    service: 'Power Within Native Backend',
    message: 'Native backend API is running.',
  })
})

app.use('/api/health', healthRoutes)
app.use('/api/system', systemRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/admin/developer/errors', developerErrorRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/public/error-reports', frontendErrorRoutes)
app.use('/api/public', publicRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app