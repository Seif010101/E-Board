// Brand marks and colours for social platforms (simple-icons, CC0). LinkedIn is not in
// simple-icons, so its "in" mark is drawn here (letters are cut out of the square with even-odd fill).

import {
  siDiscord,
  siFacebook,
  siGithub,
  siInstagram,
  siReddit,
  siSignal,
  siSnapchat,
  siTelegram,
  siThreads,
  siTiktok,
  siWhatsapp,
  siX,
  siYoutube
} from 'simple-icons'
import { SOCIAL_PLATFORMS, type SocialAccount, type SocialPlatform } from '@shared/types'

export interface BrandDef {
  /** SVG path for a 24×24 viewBox. */
  path: string
  /** Even-odd fill (needed for the hand-drawn LinkedIn mark). */
  evenOdd?: boolean
  /** Brand colour used for the glyph on neutral backgrounds. */
  color: string
  /** Background of a "lit" row (colour or gradient). */
  bg: string
  /** Text/glyph colour on top of `bg`. */
  fg: string
}

const LINKEDIN_PATH =
  'M5 2h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z' +
  'M7.2 5.6a1.65 1.65 0 1 0 0 3.3a1.65 1.65 0 1 0 0-3.3z' +
  'M5.8 10h2.8v8.4H5.8z' +
  'M10.6 10h2.7v1.25c.5-.85 1.55-1.5 3-1.5 2.6 0 3.2 1.7 3.2 3.9v4.75h-2.8v-4.2c0-1.05-.2-2-1.45-2-1.3 0-1.85.95-1.85 2.1v4.1h-2.8z'

export const BRANDS: Record<SocialPlatform, BrandDef> = {
  facebook: { path: siFacebook.path, color: '#1877F2', bg: '#1877F2', fg: '#ffffff' },
  instagram: {
    path: siInstagram.path,
    color: '#E1306C',
    bg: 'linear-gradient(90deg, #833AB4 0%, #E1306C 55%, #F77737 100%)',
    fg: '#ffffff'
  },
  x: { path: siX.path, color: '#000000', bg: '#000000', fg: '#ffffff' },
  tiktok: { path: siTiktok.path, color: '#010101', bg: '#010101', fg: '#ffffff' },
  snapchat: { path: siSnapchat.path, color: '#E8C900', bg: '#FFFC00', fg: '#141414' },
  linkedin: { path: LINKEDIN_PATH, evenOdd: true, color: '#0A66C2', bg: '#0A66C2', fg: '#ffffff' },
  telegram: { path: siTelegram.path, color: '#26A5E4', bg: '#26A5E4', fg: '#ffffff' },
  whatsapp: { path: siWhatsapp.path, color: '#25D366', bg: '#25D366', fg: '#ffffff' },
  youtube: { path: siYoutube.path, color: '#FF0000', bg: '#FF0000', fg: '#ffffff' },
  threads: { path: siThreads.path, color: '#000000', bg: '#000000', fg: '#ffffff' },
  reddit: { path: siReddit.path, color: '#FF4500', bg: '#FF4500', fg: '#ffffff' },
  discord: { path: siDiscord.path, color: '#5865F2', bg: '#5865F2', fg: '#ffffff' },
  github: { path: siGithub.path, color: '#181717', bg: '#181717', fg: '#ffffff' },
  signal: { path: siSignal.path, color: '#3A76F0', bg: '#3A76F0', fg: '#ffffff' }
}

/** Accounts grouped by platform in canonical order: platforms with accounts first. */
export function groupSocials(socials: SocialAccount[]): { lit: SocialAccount[]; dim: SocialPlatform[] } {
  const lit: SocialAccount[] = []
  const dim: SocialPlatform[] = []
  for (const platform of SOCIAL_PLATFORMS) {
    const accounts = socials.filter((s) => s.platform === platform && s.handle)
    if (accounts.length) lit.push(...accounts)
    else dim.push(platform)
  }
  return { lit, dim }
}
