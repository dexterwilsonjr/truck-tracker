import { serve } from '@hono/node-server'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://truck:local-test-only@127.0.0.1:55432/truck_tracker_test'
process.env.FRONTEND_ORIGIN = 'http://127.0.0.1:4173'
const { sql, migrate } = await import('../server/db.ts')
const { app } = await import('../server/index.ts')
const { hashPassword } = await import('../server/auth/passwords.ts')
await migrate()
const bands = await sql<{ id: string }[]>`INSERT INTO bands(slug,name) VALUES ('browser-band','Browser test band') ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`
const bandId = bands[0]!.id
const hash = await hashPassword('browser-test-password-12')
const users = await sql<{ id: string }[]>`INSERT INTO users(email,password_hash,name) VALUES ('browser@example.test',${hash},'Browser crew') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash, must_reset_password=false RETURNING id`
await sql`INSERT INTO band_members(band_id,user_id,role) VALUES (${bandId},${users[0]!.id},'marshal') ON CONFLICT DO NOTHING`
// A second account, so friend-sharing flows can connect two different people
// rather than an account inviting itself.
const friends = await sql<{ id: string }[]>`INSERT INTO users(email,password_hash,name) VALUES ('friend@example.test',${hash},'Browser friend') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash, must_reset_password=false RETURNING id`
await sql`DELETE FROM connections WHERE requester_id = ${users[0]!.id} OR addressee_id = ${users[0]!.id} OR requester_id = ${friends[0]!.id} OR addressee_id = ${friends[0]!.id}`
await sql`INSERT INTO band_entitlements(band_id,module_code) VALUES (${bandId},'truck_tracker') ON CONFLICT(band_id,module_code) DO UPDATE SET status='active',starts_at=now(),ends_at=null`
await sql`INSERT INTO trucks(band_id,name) VALUES (${bandId},'Browser truck') ON CONFLICT(band_id) DO UPDATE SET public_live=false,share_id=null`
await sql`INSERT INTO band_entitlements(band_id,module_code) VALUES (${bandId},'guide') ON CONFLICT(band_id,module_code) DO UPDATE SET status='active',starts_at=now(),ends_at=null`
await sql`INSERT INTO band_entitlements(band_id,module_code) VALUES (${bandId},'friends') ON CONFLICT(band_id,module_code) DO UPDATE SET status='active',starts_at=now()-interval '1 day',ends_at=null`
await sql`INSERT INTO band_content(band_id,guide) VALUES (${bandId}, ${sql.json({ title:'Offline event guide', location:'Scarborough', schedule:['Details to be confirmed'], notes:['Follow your marshal on the road.'] })}) ON CONFLICT(band_id) DO UPDATE SET guide=EXCLUDED.guide`
serve({fetch:app.fetch,port:8788})
