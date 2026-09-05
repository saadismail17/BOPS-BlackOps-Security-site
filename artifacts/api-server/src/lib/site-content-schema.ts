import { z } from "zod/v4";

const cta = z.object({ label: z.string(), href: z.string() });
const textItem = z.object({ title: z.string(), description: z.string() });
const background = z.object({ desktopUrl: z.string(), mobileUrl: z.string() });

export const siteContentSchema = z
  .object({
    branding: z.object({
      name: z.string(),
      byline: z.string(),
      logoUrl: z.string(),
    }),
    hero: z.object({
      eyebrow: z.string(),
      title: z.string(),
      description: z.string(),
      primaryCta: cta,
      secondaryCta: cta,
      audienceWords: z.array(z.string()),
    }),
    stats: z.array(z.object({ value: z.string(), label: z.string() })),
    about: z.object({
      eyebrow: z.string(),
      title: z.string(),
      description: z.string(),
      pillars: z.array(textItem),
    }),
    services: z.object({
      eyebrow: z.string(),
      title: z.string(),
      description: z.string(),
      items: z.array(textItem.extend({ icon: z.string().optional() })),
    }),
    advantages: z.object({
      eyebrow: z.string(),
      title: z.string(),
      items: z.array(textItem),
    }),
    faq: z.object({
      eyebrow: z.string(),
      title: z.string(),
      items: z.array(z.object({ question: z.string(), answer: z.string() })),
    }),
    contact: z.object({
      eyebrow: z.string(),
      title: z.string(),
      description: z.string(),
      formTitle: z.string(),
      email: z.string(),
      phone: z.string(),
      address: z.string(),
    }),
    footer: z.object({ copy: z.string(), legalCopy: z.string() }),
    socialUrls: z.object({
      instagram: z.string(),
      facebook: z.string(),
      linkedin: z.string(),
    }),
    marqueeWords: z.array(z.string()),
    backgrounds: z.object({
      about: background,
      services: background,
      faq: background,
    }),
  })
  .strict();

export const uploadRequestSchema = z
  .object({
    name: z.string().min(1),
    size: z.number().int().min(1).max(10 * 1024 * 1024),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  })
  .strict();

export type SiteContent = z.infer<typeof siteContentSchema>;