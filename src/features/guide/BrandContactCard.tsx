import { brand } from "@/config/brand"
import { brandContactChannels } from "@/config/contact"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Card, SectionLabel } from "@/components/ui/Primitives"

export function BrandContactCard() {
  const channels = brandContactChannels(brand.contact)

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
                <span className="block text-sm font-semibold">{channel.label}</span>
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
