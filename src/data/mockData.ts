import { brand } from "@/config/brand"
import type {
  Announcement,
  Faq,
  GuidePhase,
  SamplePhoto,
  TruckState,
} from "@/types/models"
import { daysAgo, hoursAgo, minutesAgo } from "@/utils/time"

/**
 * Seed content for the prototype.
 *
 * Everything here is clearly labelled SAMPLE / placeholder — no real dates,
 * locations or GPS positions are implied. Replace this file's exports with a
 * call into a real data service when the band's feeds go live.
 */

const tbcDate = "February 2026 — dates to be confirmed"

export function createMockTruck(): TruckState {
  return {
    truckName: "Blaze",
    status: "live",
    message:
      "Rolling smooth through Scarborough. See you at the meet point.",
    lastUpdateISO: minutesAgo(3),
  }
}

export function createMockAnnouncements(): Announcement[] {
  return [
    {
      id: "sample-pin-collection",
      category: "collection",
      title: "Costume collection opens this Saturday",
      body:
        "Collect your full costume at the storehouse between 10:00 AM and 4:00 PM. " +
        "Bring your booking reference and photo ID. J'ouvert and Pretty Mas costumes " +
        "are both ready — please arrive early if you still need a fitting.",
      publishedAt: hoursAgo(5),
      pinned: true,
      sample: true,
    },
    {
      id: "sample-road-out",
      category: "on-the-road",
      title: "Blaze is rolling out of the depot",
      body:
        "The truck has left the storehouse on Store Bay Road and is heading toward the " +
        "meet-up point. We're on schedule — golden vibes only.",
      publishedAt: minutesAgo(12),
      sample: true,
    },
    {
      id: "sample-general-route",
      category: "general",
      title: "Route tweak for the Pretty Mas leg",
      body:
        "After the judging point we'll loop along the Milford Road side to avoid " +
        "roadworks. Truck marshals will guide you at every turn — just follow the " +
        "blaze.",
      publishedAt: hoursAgo(2),
      sample: true,
    },
    {
      id: "sample-road-pitstop",
      category: "on-the-road",
      title: "Pit stop — water and ice restock",
      body:
        "Quick restock at the Scarborough depot. We'll be moving again within the " +
        "hour. Cold drinks and coconuts on the truck as always.",
      publishedAt: hoursAgo(4),
      sample: true,
    },
    {
      id: "sample-collection-section",
      category: "collection",
      title: "Last call — add your crew to the truck list",
      body:
        "Crews with ten or more costumes ride together. Tell your section leader " +
        "before collection day so we can keep your group on one truck.",
      publishedAt: daysAgo(1),
      sample: true,
    },
  ]
}

export function createMockGuide(): {
  phases: GuidePhase[]
  faqs: Faq[]
} {
  const phases: GuidePhase[] = [
    {
      id: "jouvert",
      name: "J'ouvert",
      shortName: "J'ouvert",
      description:
        "Dawn breaks over the mas camp — paint, mud and the first road of the season.",
      meeting: {
        name: "J'ouvert meet-up",
        dateLabel: tbcDate,
        timeLabel: "4:00 AM",
        location: "Scarborough, Tobago — exact spot to be confirmed",
        note:
          "Final meet-up point is confirmed closer to the event and pinned in Updates.",
        confirmed: false,
      },
      schedule: [
        {
          id: "j1",
          timeLabel: "4:00 AM",
          title: "Line-up at the meet-up point",
          note: "Collect your glow kit and water before roll-out.",
        },
        {
          id: "j2",
          timeLabel: "4:30 AM",
          title: "J'ouvert crosses",
          note: "First road of the season — stay with the truck.",
        },
        {
          id: "j3",
          timeLabel: "7:30 AM",
          title: "Breakfast stop",
          note: "Bake and shark packs handed out by the truck.",
        },
        {
          id: "j4",
          timeLabel: "10:00 AM",
          title: "Return to the storehouse",
        },
      ],
      costume: {
        name: "J'ouvert Colour Splash",
        collectionDateLabel: tbcDate,
        collectionLocation: "Storehouse, Milford Road, Scarborough",
        bringWithYou: [
          "Booking reference (paper or phone)",
          "Photo ID",
          "A bag for your colour kit",
        ],
        confirmed: false,
      },
    },
    {
      id: "pretty-mas",
      name: "Pretty Mas",
      shortName: "Pretty Mas",
      description:
        "The main parade — feathers, beads and the full band rolling across Tobago.",
      meeting: {
        name: "Pretty Mas meet-up",
        dateLabel: tbcDate,
        timeLabel: "12:00 PM",
        location: "Scarborough Esplanade — exact spot to be confirmed",
        note:
          "Be on the truck no later than 11:30 AM for the warm-up lap.",
        confirmed: false,
      },
      schedule: [
        {
          id: "p1",
          timeLabel: "11:30 AM",
          title: "Last call — board the truck",
        },
        {
          id: "p2",
          timeLabel: "12:00 PM",
          title: "Crossing the judging point",
          note: "Band of the year run — give the judges everything.",
        },
        {
          id: "p3",
          timeLabel: "3:00 PM",
          title: "Water and lime stop",
        },
        {
          id: "p4",
          timeLabel: "6:00 PM",
          title: "Wrap party back at camp",
          note: "TBC — watch Updates.",
        },
      ],
      costume: {
        name: "Masquerade '26",
        collectionDateLabel: tbcDate,
        collectionLocation: "Storehouse, Milford Road, Scarborough",
        bringWithYou: [
          "Booking reference (paper or phone)",
          "Photo ID",
          "Comfortable shoes for the parade",
        ],
        confirmed: false,
      },
    },
  ]

  const faqs: Faq[] = [
    {
      id: "faq-live",
      question: "Is the truck map live?",
      answer:
        "Not yet. This build shows a schematic demo map so you can get a feel for the " +
        "experience. Real GPS positions will connect before the event and are never " +
        "simulated as actual truck locations.",
    },
    {
      id: "faq-tickets",
      question: "Can I buy a costume or ticket here?",
      answer:
        "No — this app complements the band's website. Costume registration and " +
        "bookings stay on the official site so payments are handled properly.",
    },
    {
      id: "faq-times",
      question: "What time does J'ouvert start?",
      answer:
        "Line-up is planned for 4:00 AM on the first carnival morning. Times are " +
        "placeholders until organisers confirm them — the pinned announcement will " +
        "carry the final schedule.",
    },
    {
      id: "faq-phone",
      question: "I lost my crew on the road. What do I do?",
      answer:
        "Stay near the truck and ask a marshal for help. Real phones, WhatsApp and " +
        "map links arrive in the live build — for now use the contact channels above " +
        "once the band configures them.",
    },
  ]

  return { phases, faqs }
}

/** Placeholder gallery artwork — elegant gradients, no real photography. */
export function createSamplePhotos(): SamplePhoto[] {
  const rows: SamplePhoto[] = [
    { id: "ph1", category: "jouvert", title: "First light on the road", variant: 0 },
    { id: "ph2", category: "jouvert", title: "Colour splash crew", variant: 1 },
    { id: "ph3", category: "jouvert", title: "Mud mas morning", variant: 2 },
    { id: "ph4", category: "jouvert", title: "Glow kit check", variant: 3 },
    { id: "ph5", category: "pretty-mas", title: "Feathers at the judging point", variant: 4 },
    { id: "ph6", category: "pretty-mas", title: "Pretty mas parade", variant: 5 },
    { id: "ph7", category: "pretty-mas", title: "On the truck — golden hour", variant: 6 },
    { id: "ph8", category: "pretty-mas", title: "Wrap party lights", variant: 7 },
  ]
  return rows.map((p) => ({
    ...p,
    title: `${p.title} — sample`,
  }))
}

/** Convenience for demos that want the full seed at once. */
export function createMockData() {
  return {
    truck: createMockTruck(),
    announcements: createMockAnnouncements(),
    ...createMockGuide(),
    bandName: brand.bandName,
    eventLabel: `${brand.eventLabel} ${brand.eventYear}`,
  }
}
