import type { BrandContact } from "@/config/brands/types"
import type { IconName } from "@/components/ui/Icon"

export interface BrandChannel {
  key: string
  icon: IconName
  label: string
  value: string
  href: string
}

function instagramHandle(raw: string): string {
  const match = raw.trim().match(/instagram\.com\/([^/?#]+)/i)
  return (match?.[1] ?? raw.trim().replace(/^@/, "")).replace(/\/+$/, "")
}

function websiteHref(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

function websiteLabel(raw: string): string {
  return raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "")
}

export function brandContactChannels(contact: BrandContact): BrandChannel[] {
  const channels: BrandChannel[] = []
  if (contact.phone.trim()) {
    const digits = contact.phone.replace(/[^\d+]/g, "")
    channels.push({
      key: "phone",
      icon: "phone",
      label: "Call the band",
      value: contact.phone,
      href: `tel:${digits}`,
    })
  }
  if (contact.whatsapp.trim()) {
    const digits = contact.whatsapp.replace(/\D/g, "")
    channels.push({
      key: "whatsapp",
      icon: "message",
      label: "WhatsApp the crew",
      value: contact.whatsapp,
      href: `https://wa.me/${digits}`,
    })
  }
  if (contact.email.trim()) {
    channels.push({
      key: "email",
      icon: "mail",
      label: "Email the band",
      value: contact.email,
      href: `mailto:${contact.email}`,
    })
  }
  if (contact.instagram.trim()) {
    const handle = instagramHandle(contact.instagram)
    channels.push({
      key: "instagram",
      icon: "compass",
      label: "Instagram",
      value: `@${handle}`,
      href: `https://www.instagram.com/${handle}/`,
    })
  }
  if (contact.website.trim()) {
    channels.push({
      key: "website",
      icon: "globe",
      label: "Band website",
      value: websiteLabel(contact.website),
      href: websiteHref(contact.website),
    })
  }
  return channels
}
