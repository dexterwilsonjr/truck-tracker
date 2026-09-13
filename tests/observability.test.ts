import { test } from "node:test"
import assert from "node:assert/strict"

import { redact, newCorrelationId } from "../server/observability/log.ts"

/**
 * Log hygiene.
 *
 * These are privacy tests, not formatting tests. A coordinate or a token that
 * reaches a log line is as serious as one that reaches a response, because logs
 * are retained, shipped, and read by more people than the database is.
 */

test('redact removes tokens, cookies, coordinates and query strings', () => {
  const inviteToken = "f1fa6ce28dd86ccb6d0e193284f67df8eb829d31dbf290d8cc3d9316e0f8a"
  const sessionToken = "5d7617a7d0ce3ee98c1fd5f7dc693cdb187d4a8b7fb449f0c02f7129918a0dfd"

  assert.doesNotMatch(redact(`/friends/bands/fog-angels/invites/${inviteToken}`), /f1fa6ce2/)
  assert.doesNotMatch(redact(`Cookie: __session=${sessionToken}`), /5d7617a7/)
  assert.doesNotMatch(redact("Authorization: Bearer abc123def456"), /abc123def456/)
  assert.doesNotMatch(redact("/reset?token=deadbeefdeadbeefdeadbeefdeadbeef"), /deadbeef/)

  // A coordinate must never survive, whichever field it arrives in. The pattern
  // targets the precision a GPS fix actually carries.
  assert.doesNotMatch(redact("position 11.1811,-60.7333 rejected"), /11\.1811|-60\.7333/)
  assert.doesNotMatch(redact('{"lat":11.182345,"lng":-60.735678}'), /11\.182345/)

  // Ordinary copy must survive, or the logs become useless.
  assert.match(redact("Truck not found."), /Truck not found\./)
  assert.match(redact("Friend sharing is not available for this band."), /Friend sharing/)
})

test('a correlation id is short, unique and safe to read aloud', () => {
  const ids = new Set(Array.from({ length: 200 }, () => newCorrelationId()))
  assert.equal(ids.size, 200, "ids must not collide")
  for (const id of ids) assert.match(id, /^[a-f0-9]{12}$/)
})

test('redact is honest about what it does not catch', () => {
  // Coarse values are left alone on purpose. The pattern targets the precision a
  // real GPS fix carries, so that latency and version numbers in logs stay
  // readable. Two decimals is roughly a kilometre and is not a location.
  assert.equal(redact("v1.2.0 in 205.12ms"), "v1.2.0 in 205.12ms")
})
