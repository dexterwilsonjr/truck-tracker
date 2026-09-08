import { Link } from "react-router-dom"

import { brand } from "@/config/brand"
import { Card } from "@/components/ui/Primitives"

export function PrivacyScreen() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 motion-safe:animate-fade-up">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-gold">
        {brand.productName}
      </p>
      <h1 className="font-display text-3xl font-bold tracking-tight">Privacy</h1>
      <Card className="space-y-4 p-5 text-[15px] leading-relaxed text-muted">
        <p>
          Password accounts store an email, a name, and a password hash — never
          the password itself. Reset links expire in an hour. Sessions live in
          an httpOnly cookie.
        </p>
        <p>
          You can browse a band without an account. Sign-in is for Library,
          print requests, face match, and saving your place near the truck when
          those are turned on.
        </p>
        <p>
          Location is not collected in Platform V1. When live tracking ships, the
          public map shows the truck — not you. Relative distance stays on your
          device or your signed-in account. We do not sell location.
        </p>
        <p>
          Photos in Library (later contract) stay under your account. Face match
          is opt-in. Print partners receive the image you chose and the order —
          not government ID.
        </p>
        <p>
          Tobago ID is coming later as an optional sign-in. If you link it, we
          store the minimum claims needed to know it is you. No ID documents.
        </p>
        <p>
          Full policy: see <code className="text-gold">docs/privacy.md</code> in
          the project, or ask the band for the signed copy on contract.
        </p>
      </Card>
      <Link
        to="/"
        className="inline-flex h-11 items-center text-sm font-semibold text-gold underline decoration-dotted underline-offset-4"
      >
        Back
      </Link>
    </div>
  )
}
