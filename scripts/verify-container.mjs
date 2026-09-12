import { spawnSync } from 'node:child_process'
const result = spawnSync('docker', ['run','--rm','--platform','linux/amd64',
  '-e','NODE_ENV=production',
  '-e','DATABASE_URL=postgres://truck:local-test-only@host.docker.internal:55432/truck_tracker_test',
  '-e','FRONTEND_ORIGIN=https://windies-truck-tracker.web.app',
  '-e','SESSION_SECRET=container-smoke-test-only-not-production-123456',
  '-e','MAIL_FROM=Truck Tracker <noreply@example.test>',
  '-e','RESEND_API_KEY=container-smoke-test-only',
  'truck-tracker:1.2','node','--import','tsx','--input-type=module','-e',
  'const {loadEnv}=await import("./server/env.ts");loadEnv();const {sql,migrate}=await import("./server/db.ts");await migrate();await sql`SELECT 1`;console.log("Linux production runtime and database migration passed");await sql.end();'], {stdio:'inherit'})
process.exit(result.status ?? 1)
