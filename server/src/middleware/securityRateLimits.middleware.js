const rateLimit = require('express-rate-limit')

function jsonRateLimitHandler(message) {
  return (req, res) => {
    res.status(429).json({
      ok: false,
      error: message,
      requestId: req.requestId || undefined,
    })
  }
}

const authenticationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler(
    'Too many authentication attempts. Please wait 15 minutes and try again.',
  ),
})

const passwordChangeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonRateLimitHandler(
    'Too many password-change attempts. Please wait 15 minutes and try again.',
  ),
})

const frontendErrorReportRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonRateLimitHandler(
    'Too many error reports were submitted. Please try again later.',
  ),
})

const publicSubmissionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonRateLimitHandler(
    'Too many submissions were received. Please wait and try again.',
  ),
})

module.exports = {
  authenticationRateLimit,
  passwordChangeRateLimit,
  frontendErrorReportRateLimit,
  publicSubmissionRateLimit,
}
