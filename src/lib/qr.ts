import qrcode from "qrcode-generator"

/**
 * Render text as a scannable QR code.
 *
 * Returns an SVG data URL rather than markup, so the caller uses an `<img>`
 * and nothing has to be injected into the document. The encoder picks the
 * smallest version that fits, with medium error correction — the standard
 * trade-off for a phone camera held a few feet away.
 *
 * The result is always dark modules on a light background. QR reading depends
 * on contrast, so callers must place it on a light surface even though the rest
 * of the app is dark.
 */
export function qrDataUrl(text: string, cellSize = 6, margin = 4): string {
  const code = qrcode(0, "M")
  code.addData(text)
  code.make()
  const svg = code.createSvgTag({ cellSize, margin, scalable: true })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
