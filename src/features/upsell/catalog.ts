import { brand } from "@/config/brand"
import type { ModuleCode } from "@/config/modules"

/** Patron-facing names. Never show SKU codes in UI. */
export const MODULE_TITLES: Record<ModuleCode, string> = {
  truck_tracker: "Live tracking",
  friends: "Find your friends",
  updates: "Updates",
  guide: "Guide",
  photos: "Photos & Library",
  push: "Notifications",
  face_mapping: "Face match",
  print: "Print",
}

export interface UpsellCopy {
  module: ModuleCode
  /** Patron-facing. Carnival voice. Never SKU codes. */
  patron: {
    headline: string
    body: string
    cta: string
  }
  /** Organizer / sales. Still human. */
  organizer: {
    headline: string
    body: string
    cta: string
  }
  comingOnline: {
    headline: string
    body: string
  }
}

export const UPSELL_CATALOG: Record<ModuleCode, UpsellCopy> = {
  truck_tracker: {
    module: "truck_tracker",
    patron: {
      headline: "Find the truck",
      body: "This band hasn’t turned live tracking on yet. When they do, you’ll see the pin, last update, and the meet-up — no account needed.",
      cta: "This band hasn’t turned this on yet",
    },
    organizer: {
      headline: "Add live truck tracking",
      body: "Pin the band truck on the map with a Teltonika box. Marshals can share from a phone if the box drops. Patrons don’t need an account to see it.",
      cta: "Add live tracking to this band",
    },
    comingOnline: {
      headline: "Live tracking is coming online",
      body: "This band’s plan includes the truck map. We’re finishing the road setup — last-known will show here, never a fake pin.",
    },
  },
  friends: {
    module: "friends",
    patron: {
      headline: "Find your friends",
      body: "This band hasn’t switched friend sharing on yet. When they do, you invite the people you came with, you choose when to share, and you can stop or block at any moment.",
      cta: "This band hasn’t turned this on yet",
    },
    organizer: {
      headline: "Add Find Your Friend",
      body: "Patrons invite each other and share their location for the event only. Nobody appears on the map until they choose to share, and anyone can stop sharing or block someone immediately.",
      cta: "Add friend sharing to this band",
    },
    comingOnline: {
      headline: "Friend sharing is coming online",
      body: "This band’s plan includes Find Your Friend. We’re finishing the consent and safety setup — who can see you stays your choice.",
    },
  },
  updates: {
    module: "updates",
    patron: {
      headline: "Word from the road",
      body: "This band hasn’t posted live updates in the app yet. When they do, you’ll get collection news and on-the-road word here.",
      cta: "This band hasn’t turned this on yet",
    },
    organizer: {
      headline: "Add Updates",
      body: "Pin announcements for collection, roll-out and delays. Same feed patrons already know from the demo.",
      cta: "Add Updates to this band",
    },
    comingOnline: {
      headline: "Updates are coming online",
      body: "This band’s plan includes the feed. It will land here — no fake posts in the meantime.",
    },
  },
  guide: {
    module: "guide",
    patron: {
      headline: "Meet-up and schedule",
      body: "This band hasn’t published J’ouvert and Pretty Mas details in the app yet. Tickets and costumes still live on their site.",
      cta: "This band hasn’t turned this on yet",
    },
    organizer: {
      headline: "Add the Guide",
      body: "Meet-up times, costume collection, FAQs. Complements the band site — no ticket sales in-app.",
      cta: "Add the Guide to this band",
    },
    comingOnline: {
      headline: "The Guide is coming online",
      body: "This band’s plan includes meet-up and schedule. Confirmed times will show here.",
    },
  },
  photos: {
    module: "photos",
    patron: {
      headline: "Keep your pics in the cloud",
      body: `This band hasn’t turned Photos on yet. When they do, the gallery is here — and with an account, ${brand.productName} Library holds your event album so you don’t have to save it on the phone.`,
      cta: "This band hasn’t turned this on yet",
    },
    organizer: {
      headline: "Add Photos and Library",
      body: "Band gallery for the road, plus a private cloud album for signed-in patrons. They can view and download. Print is a later add-on.",
      cta: "Add Photos to this band",
    },
    comingOnline: {
      headline: "Photos are coming online",
      body: "This band’s plan includes the gallery and Library. No sample pictures pretending to be live uploads.",
    },
  },
  push: {
    module: "push",
    patron: {
      headline: "A nudge when it matters",
      body: "This band hasn’t turned notifications on yet. When they do, you can hear about delays and new word without refreshing.",
      cta: "This band hasn’t turned this on yet",
    },
    organizer: {
      headline: "Add Push",
      body: "Web push for announcements and truck delays — not a ping on every GPS fix. Needs Updates and/or live tracking on the plan.",
      cta: "Add Push to this band",
    },
    comingOnline: {
      headline: "Notifications are coming online",
      body: "This band’s plan includes push. We’ll ask permission only when it’s real.",
    },
  },
  face_mapping: {
    module: "face_mapping",
    patron: {
      headline: "Help find your shots",
      body: "This band hasn’t turned face match on yet. It’s optional, and paint, mud and night mean it can miss. Hits land in your Library — not a guarantee.",
      cta: "This band hasn’t turned this on yet",
    },
    organizer: {
      headline: "Add Face Mapping",
      body: "Opt-in selfie match into each patron’s Library. Needs Photos. Sell it honestly — not as guaranteed ID.",
      cta: "Add Face Mapping to this band",
    },
    comingOnline: {
      headline: "Face match is coming online",
      body: "This band’s plan includes opt-in face match. Nothing runs until you and the patron say so.",
    },
  },
  print: {
    module: "print",
    patron: {
      headline: "Print your pretty",
      body: "This band hasn’t turned print requests on yet. When they do, you pick a Library photo and we send that file to a print partner.",
      cta: "This band hasn’t turned this on yet",
    },
    organizer: {
      headline: "Add Print",
      body: "Patrons request a print from Library. We send the image and order to your partner — no card checkout in the app until custom payments exist.",
      cta: "Add Print to this band",
    },
    comingOnline: {
      headline: "Print requests are coming online",
      body: "This band’s plan includes print. Partner setup happens before patrons can send a file.",
    },
  },
}

export const ALSO_ON_THE_ROAD: ModuleCode[] = [
  "truck_tracker",
  "friends",
  "updates",
  "guide",
  "photos",
  "push",
  "face_mapping",
  "print",
]
