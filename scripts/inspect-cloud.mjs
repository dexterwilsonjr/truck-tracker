import { execFileSync } from 'node:child_process'
import postgres from 'postgres'
const project = 'windies-app'
const read = args => execFileSync('gcloud', [...args, '--project', project], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
const url = read(['secrets','versions','access','latest','--secret','windies-db-url'])
const parsed = new URL(url)
console.log('Database host:', parsed.hostname, 'Database name:', parsed.pathname)
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 })
try {
  console.log('Database permissions:', await sql`SELECT current_user AS role, rolcreatedb FROM pg_roles WHERE rolname = current_user`)
  console.log('Existing databases:', await sql`SELECT datname FROM pg_database WHERE NOT datistemplate`)
  console.log('Tracker schemas:', await sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '%truck%'`)
  const svc = JSON.parse(read(['run','services','describe','windies-api','--region','us-central1','--format=json']))
  const env = svc.spec.template.spec.containers[0].env ?? []
  console.log('Mail sender configuration:', env.filter(e => /^(MAIL_FROM|RESEND_FROM|EMAIL_FROM)$/.test(e.name)))
 } catch (e) { console.error('Inspection failed:', e.code ?? e.name, String(e.message).replaceAll(url, '[connection]').replaceAll(parsed.password, '[redacted]').replaceAll(decodeURIComponent(parsed.password), '[redacted]')) } finally { await sql.end() }
