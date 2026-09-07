import { useState } from "react"
import { useId } from "react"

import { brand } from "@/config/brand"
import { useDemo } from "@/state/demo-context"
import type { Faq, GuidePhase } from "@/types/models"
import { Card, Chip, Divider, SectionLabel } from "@/components/ui/Primitives"
import { Segmented } from "@/components/ui/Segmented"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import type { IconName } from "@/components/ui/Icon"

interface ContactChannel {
  key: string
  icon: IconName
  label: string
  value: string
  href: string
}

function buildChannels(): ContactChannel[] {
  const c = brand.contact
  const channels: ContactChannel[] = []
  if (c.phone.trim()) {
    const digits = c.phone.replace(/[^\d+]/g, "")
    channels.push({
      key: "phone",
      icon: "phone",
      label: "Call the band",
      value: c.phone,
      href: `tel:${digits}`,
    })
  }
  if (c.whatsapp.trim()) {
    const digits = c.whatsapp.replace(/\D/g, "")
    channels.push({
      key: "whatsapp",
      icon: "message",
      label: "WhatsApp the crew",
      value: c.whatsapp,
      href: `https://wa.me/${digits}`,
    })
  }
  if (c.email.trim()) {
    channels.push({
      key: "email",
      icon: "mail",
      label: "Email the band",
      value: c.email,
      href: `mailto:${c.email}`,
    })
  }
  if (c.instagram.trim()) {
    const handle = c.instagram.replace(/^@/, "")
    channels.push({
      key: "instagram",
      icon: "compass",
      label: "Instagram",
      value: `@${handle}`,
      href: `https://instagram.com/${handle}`,
    })
  }
  if (c.website.trim()) {
    const url = /^https?:\/\//.test(c.website) ? c.website : `https://${c.website}`
    channels.push({
      key: "website",
      icon: "globe",
      label: "Band website",
      value: c.website,
      href: url,
    })
  }
  return channels
}

export function GuideScreen() {
  const { snapshot } = useDemo()
  const [activeId, setActiveId] = useState<"jouvert" | "pretty-mas">("jouvert")
  const phase = snapshot.phases.find((p) => p.id === activeId) ?? snapshot.phases[0]!

  return (
    <div className="space-y-6 motion-safe:animate-fade-up">
      <header>
        <h1 className="font-display text-[30px] leading-none font-bold tracking-tight sm:text-4xl">
          Event guide
        </h1>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">
          Meet-up times, the day's route and what to bring. Placeholder dates
          are marked until organisers confirm.
        </p>
      </header>

      <Segmented
        label="Choose event day"
        options={snapshot.phases.map((p) => ({
          value: p.id,
          label: p.shortName,
        }))}
        value={activeId}
        onChange={setActiveId}
      />

      <PhaseContent phase={phase} />

      <FaqSection faqs={snapshot.faqs} />
      <ContactSection />
    </div>
  )
}

function PhaseContent({ phase }: { phase: GuidePhase }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            {phase.name}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            {phase.description}
          </p>
        </div>
        {phase.meeting.confirmed ? (
          <Chip tone="live">Dates confirmed</Chip>
        ) : (
          <Chip tone="warn">Placeholder — TBC</Chip>
        )}
      </div>

      {/* Meeting */}
      <Card className="p-5">
        <SectionLabel>Meeting point</SectionLabel>
        <div className="mt-4 space-y-4">
          <InfoRow icon="calendar" title="Date" value={phase.meeting.dateLabel} />
          <InfoRow icon="clock" title="Time" value={phase.meeting.timeLabel} />
          <InfoRow icon="map-pin" title="Where" value={phase.meeting.location} />
        </div>
        {phase.meeting.note && (
          <p className="mt-4 rounded-2xl border border-line bg-night/40 px-4 py-3 text-[13px] leading-relaxed text-muted">
            {phase.meeting.note}
          </p>
        )}
      </Card>

      {/* Schedule */}
      <Card className="p-5">
        <SectionLabel>Day schedule</SectionLabel>
        <ol className="mt-4 space-y-1">
          {phase.schedule.map((item, index) => (
            <li
              key={item.id}
              className="flex items-start gap-4 rounded-2xl px-2 py-3 transition hover:bg-white/[0.03]"
            >
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-night/50 text-xs font-bold text-gold"
              >
                {index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[15px] font-semibold text-ink">
                  <span className="mr-2 text-[13px] font-bold tabular-nums text-gold">
                    {item.timeLabel}
                  </span>
                  {item.title}
                </p>
                {item.note && (
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
                    {item.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {/* Costume collection */}
      <Card className="p-5">
        <SectionLabel>Costume collection</SectionLabel>
        <h3 className="mt-2 font-display text-lg font-bold">{phase.costume.name}</h3>
        <div className="mt-4 space-y-4">
          <InfoRow
            icon="calendar"
            title="Collect from"
            value={`${phase.costume.collectionDateLabel} · ${phase.costume.collectionLocation}`}
          />
        </div>
        <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-faint">
          Bring with you
        </p>
        <ul className="mt-2 space-y-2">
          {phase.costume.bringWithYou.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-muted">
              <Icon name="check" className="mt-0.5 size-4 shrink-0 text-teal" />
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function InfoRow({
  icon,
  title,
  value,
}: {
  icon: IconName
  title: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon name={icon} className="mt-0.5 size-4 shrink-0 text-gold" />
      <p className="text-sm leading-relaxed text-ink">
        <span className="font-semibold text-muted">{title}: </span>
        {value}
      </p>
    </div>
  )
}

function FaqSection({ faqs }: { faqs: Faq[] }) {
  return (
    <Card>
      <div className="px-5 pt-5">
        <SectionLabel>Good to know</SectionLabel>
        <h2 className="mt-2 font-display text-xl font-bold tracking-tight">
          Frequently asked questions
        </h2>
      </div>
      <Divider className="mt-4" />
      <div className="px-2 py-2">
        {faqs.map((faq, index) => (
          <FaqItem key={faq.id} faq={faq} defaultOpen={index === 0} />
        ))}
      </div>
    </Card>
  )
}

function FaqItem({ faq, defaultOpen }: { faq: Faq; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const regionId = useId()

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.04]"
      >
        <span className="text-[15px] font-semibold text-ink">{faq.question}</span>
        <Icon
          name="chevron-down"
          className={`size-5 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div
          id={regionId}
          role="region"
          className="px-3 pb-4 motion-safe:animate-fade-in"
        >
          <p className="text-sm leading-relaxed text-muted">{faq.answer}</p>
        </div>
      )}
    </div>
  )
}

function ContactSection() {
  const channels = buildChannels()

  return (
    <Card className="p-5">
      <SectionLabel>Contact & bookings</SectionLabel>
      {channels.length === 0 ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-muted">
            Contact channels are not set up yet. Once the band shares its
            official phone, WhatsApp and social links, they will appear here —
            nothing is hard-coded or invented.
          </p>
          <p className="text-[13px] leading-relaxed text-faint">
            Costume registration and ticket sales stay on the band's website.
            This app never takes payments.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {channels.map((channel) => (
            <Button
              key={channel.key}
              variant="secondary"
              href={channel.href}
              className="justify-between"
              icon={<Icon name={channel.icon} className="size-4" />}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {channel.label}
                </span>
                <span className="block truncate text-xs font-normal text-faint">
                  {channel.value}
                </span>
              </span>
            </Button>
          ))}
          {brand.registrationUrl.trim() && (
            <Button
              href={brand.registrationUrl}
              className="sm:col-span-2"
              icon={<Icon name="pencil" className="size-4" />}
            >
              Register for a costume
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
