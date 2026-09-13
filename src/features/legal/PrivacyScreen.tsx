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
          This app is operated by <strong className="font-semibold text-ink">Windies Media Ltd.</strong>{" "}
          Questions, or a request to see or delete what we hold about you, go to your band
          organizer or the platform admin contact on the Account screen.
        </p>
        <p>
          Password accounts store an email, a name, and a password hash — never
          the password itself. Reset links expire in an hour. Sessions live in
          an httpOnly cookie.
        </p>
        <p>
          You can browse a band without an account. Sign-in is for the Library,
          future photo features, or crew controls.
        </p>
        <p>
          In 1.2, crew members can share a phone’s location while this page stays
          open. The public truck pin appears only during a live sharing session.
          End live hides the pin and deletes its stored positions. Older positions
          are pruned as new updates arrive. We do not sell location.
        </p>
        <p>
          <strong className="font-semibold text-ink">Find your friends is off until you turn it on.</strong>{" "}
          If your band includes it, you can share your location with people you invite.
          Nothing is collected until you press Start sharing, and accepting an invite does not
          start it. Only people you are connected to can see you, and only while you are sharing.
        </p>
        <p>
          We keep only your latest position, not a history of where you have been. It is
          deleted the moment you stop sharing, remove a friend, or block someone. A sharing
          session ends by itself at the end of the event. Signing out also ends your sharing
          and disconnects your phone. Blocking someone works both ways: they stop seeing you,
          you stop seeing them, and a new invite cannot reconnect you.
        </p>
        <p>
          Friend positions are never shown on the public truck map, are never saved for
          offline use, and are never sold.
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
          Public meeting details and announcements may be saved on your device
          for offline use. Precise truck positions and account responses are not
          stored in that cache. Ask your organizer about account deletion.
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
