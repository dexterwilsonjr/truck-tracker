# Operations

How to tell whether the platform is healthy, and what to do when it is not.
Written for the pilot and the carnival window.

## The three signals

| Signal | What it means | Where |
|---|---|---|
| `GET /api/health` | Process alive and database reachable. Cheap, cached, used by the uptime check. | Public |
| `GET /api/health/live` | Same, with the probe duration in `databaseMs`. A sustained rise is the earliest warning. | Public |
| `GET /api/health/ready` | The above **plus** whether the connection pool has been starved. Returns 503 when it has. | Public |

`/health/ready` is the one that matters for the failure this platform has actually
experienced. It reports `idleInTransaction` and `poolStarved`. A starved pool means
transactions are holding connections while doing no work — every later request queues
behind them and the service stops answering while still appearing to run.

## The failure to know about

During the build, a connection-pool deadlock silently took the API down. Ten
transactions were `idle in transaction` holding every pooled connection for five minutes,
and `/api/health` returned nothing at all. It was found by a load test, not by monitoring.

**Cause.** A transaction was opened, and then something inside it queried the pooled
client instead of the transaction. That needs a *second* connection while the first is
held. Past the pool size, every transaction waits on a connection only it can release.

**Rule.** Never call a helper that reads through the pooled client from inside
`sql.begin`. Entitlement checks, block checks, and anything using the root `sql` must run
before the transaction opens. The pattern and its reasoning are documented on
`writePoints` in `server/modules/friends/index.ts`.

**Diagnosis.** Either read `/health/ready`, or query directly:

```sql
SELECT pid, state, wait_event, now() - query_start AS running_for, left(query, 80)
FROM pg_stat_activity
WHERE datname = current_database() AND state = 'idle in transaction'
ORDER BY query_start;
```

**Immediate mitigation.** Route traffic back to the previous revision:

```sh
gcloud run services update-traffic truck-tracker-api --project windies-app \
  --region us-central1 --to-revisions <previous-revision>=100
```

Find the previous revision with:

```sh
gcloud run revisions list --service truck-tracker-api --project windies-app --region us-central1
```

## Alerts

Two policies notify `Truck Tracker on-call`:

- **API returning 5xx** (ERROR). More than five 5xx responses in five minutes.
- **Readiness failing** (CRITICAL). The pool starvation signature.

Definitions are committed under `monitoring/`, so they can be recreated rather than
reconstructed:

```sh
gcloud alpha monitoring policies create --project windies-app --policy-from-file=monitoring/alert-5xx.json
gcloud alpha monitoring policies create --project windies-app --policy-from-file=monitoring/alert-readiness.json
```

Both files ship with an empty `notificationChannels`. Add the on-call channel id when
recreating:

```sh
gcloud beta monitoring channels list --project windies-app
```

The readiness policy matches on a log entry rather than a user-defined metric. That is
deliberate: a user-defined metric only becomes addressable after it has received data, so
an alert built on one cannot be created until the failure it watches for has already
happened. Matching the log directly has no such bootstrapping problem.

There is also a scheduled external smoke check in `.github/workflows/smoke.yml`. It runs
every 15 minutes and fails visibly if the deployed site stops working. Note that GitHub
disables scheduled workflows after 60 days without repository activity, so it is a
convenience rather than the primary watchdog. The Cloud Monitoring policies are primary.

## Reading the logs

Every request logs one structured line with `path`, `status` and `ms`. A failure logs with
severity `ERROR` and includes a `correlationId`; a 5xx response body carries the same id,
so a user's screenshot ties directly to a stack trace.

```sh
gcloud run services logs read truck-tracker-api --project windies-app \
  --region us-central1 --limit 100
```

Filter to just failures:

```sh
gcloud logging read 'resource.labels.service_name="truck-tracker-api" AND severity>=ERROR' \
  --project windies-app --limit 50 --format='value(timestamp,jsonPayload.message,jsonPayload.correlationId)'
```

Browser errors arrive through `POST /client-errors` and land as `Client error` entries
with `where=browser`. That is the only way a patron-side breakage is visible, so treat a
cluster of them as a real incident rather than noise.

`redact()` in `server/observability/log.ts` strips tokens, cookies and coordinates before
anything is written. It deliberately does **not** strip coarse numbers, so log lines stay
readable. Do not log a position directly regardless — the redaction is a backstop, not a
licence.

## Event-day checklist

1. Confirm `/health/ready` is green and the revision is the one you expect:
   ```sh
   curl -s https://windies-truck-tracker.web.app/api/health/ready | python3 -m json.tool
   ```
2. Confirm the alerts can reach you. Monitoring policies notify an email channel, and an
   email nobody reads is not an alert.
3. Confirm the event window covers the whole event.
4. Confirm the previous revision is known and its name written down.
5. Watch `databaseMs`. If it climbs from ~150ms toward a second, something is wrong before
   users notice it.

## What is not monitored yet

- No synthetic check of the patron flow end to end. The smoke workflow checks API surface,
  not that a patron can see a pin.
- No alert on elevated latency, only on errors.
- No alerting on the delivery path for push notifications, once they exist.
- Single region. A regional outage is an outage.
