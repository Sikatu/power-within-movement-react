const { pool } = require('../src/db/pool')

async function main() {
  await pool.query(`
    UPDATE mail_templates
    SET
      body_text = replace(body_text, 'Power Within Collective?', 'Power Within Collective'),
      updated_at = now()
    WHERE body_text LIKE '%Power Within Collective?%'
  `)

  await pool.query(`
    UPDATE mail_templates
    SET
      body_text = replace(body_text, 'Power Within Collective™', 'Power Within Collective'),
      updated_at = now()
    WHERE body_text LIKE '%Power Within Collective™%'
  `)

  await pool.query(`
    UPDATE client_portal_email_logs
    SET
      body_text = replace(body_text, 'Power Within Collective?', 'Power Within Collective'),
      updated_at = now()
    WHERE body_text LIKE '%Power Within Collective?%'
  `)

  console.log('Mail Studio brand footer repaired.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
