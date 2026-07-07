const app = require('../src/app')

if (typeof app !== 'function') {
  console.error('Smoke check failed: Express app did not load.')
  process.exit(1)
}

console.log('Smoke check passed: Express app loaded successfully.')