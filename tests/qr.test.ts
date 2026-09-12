import { test } from "node:test"
import assert from "node:assert/strict"

import { qrDataUrl } from "../src/lib/qr.ts"

/**
 * Structural verification of the generated QR code.
 *
 * A scanner does not care that an image appeared; it needs a well-formed
 * symbol. These tests read the same SVG the browser receives, rebuild the
 * module grid from it, and check the parts of a QR symbol that make it
 * decodable: a square grid of a legal size, three finder patterns, and the
 * timing patterns. Without this, a broken encoder or a mis-wired data URL
 * would still look like "a picture of a QR code".
 *
 * No database access, so this file may run alongside the API tests.
 */

const CELL = 6
const MARGIN = 4

/** Rebuild the module grid from the SVG the app actually renders. */
function gridFrom(dataUrl: string): boolean[][] {
  assert.ok(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,"), "expected an SVG data URL")
  const svg = decodeURIComponent(dataUrl.slice("data:image/svg+xml;charset=utf-8,".length))

  const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
  assert.ok(viewBox, "SVG should declare a viewBox")
  const width = Number(viewBox[1])
  assert.equal(width, Number(viewBox[2]), "a QR symbol is square")
  assert.equal((width - MARGIN * 2) % CELL, 0, "the symbol must be whole cells plus the quiet zone")

  const count = (width - MARGIN * 2) / CELL
  const grid = Array.from({ length: count }, () => Array.from({ length: count }, () => false))
  const modules = svg.matchAll(/M(\d+),(\d+)l/g)
  for (const [, x, y] of modules) {
    const col = (Number(x) - MARGIN) / CELL
    const row = (Number(y) - MARGIN) / CELL
    assert.ok(Number.isInteger(col) && Number.isInteger(row), "modules sit on whole cells")
    grid[row]![col] = true
  }
  return grid
}

/** A finder pattern is a dark 7x7 ring with a light gap and a dark 3x3 core. */
function assertFinder(grid: boolean[][], top: number, left: number) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const outer = r === 0 || r === 6 || c === 0 || c === 6
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4
      const expected = outer || core
      assert.equal(
        grid[top + r]![left + c],
        expected,
        `finder at (${top},${left}) cell (${r},${c}) should be ${expected ? "dark" : "light"}`,
      )
    }
  }
}

test('a generated QR is a well-formed, decodable symbol', () => {
  const url = "http://127.0.0.1:4173/browser-band/friends?invite=f1fa6ce28dd86ccb6d0e193284f67df8eb829d31dbf290d8cc3d9316e0f8a"
  const grid = gridFrom(qrDataUrl(url))
  const size = grid.length

  // Legal QR sizes are 21 + 4n. A URL of this length lands on version 2 or 3.
  assert.ok(size >= 21, `grid should be at least 21 modules, got ${size}`)
  assert.equal((size - 21) % 4, 0, `grid size ${size} is not a legal QR version`)

  assertFinder(grid, 0, 0)
  assertFinder(grid, 0, size - 7)
  assertFinder(grid, size - 7, 0)

  // The timing patterns alternate and never cover the finders.
  for (let i = 8; i < size - 8; i++) {
    assert.equal(grid[6]![i], i % 2 === 0, `horizontal timing at ${i}`)
    assert.equal(grid[i]![6], i % 2 === 0, `vertical timing at ${i}`)
  }
})

test('different invite links encode to different symbols', () => {
  const a = gridFrom(qrDataUrl("https://example.test/band/friends?invite=" + "a".repeat(64)))
  const b = gridFrom(qrDataUrl("https://example.test/band/friends?invite=" + "b".repeat(64)))
  assert.notDeepEqual(a, b, "the payload must actually reach the symbol")
})

test('a short payload produces a smaller symbol than a long one', () => {
  const small = gridFrom(qrDataUrl("https://example.test/x")).length
  const large = gridFrom(qrDataUrl("https://example.test/" + "z".repeat(300))).length
  assert.ok(large > small, `a longer payload should use a larger version, got ${small} then ${large}`)
})
