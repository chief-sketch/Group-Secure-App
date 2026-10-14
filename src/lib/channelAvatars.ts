import {
  Hash,
  Users,
  Wallet,
  Wrench,
  ShieldCheck,
  Briefcase,
  Megaphone,
  BookOpen,
  Star,
  Globe,
} from 'lucide-react';

export const CHANNEL_ICONS = {
  Hash,
  Users,
  Wallet,
  Wrench,
  ShieldCheck,
  Briefcase,
  Megaphone,
  BookOpen,
  Star,
  Globe,
} as const;

export type ChannelIconName = keyof typeof CHANNEL_ICONS;

export const CHANNEL_ICON_LIST: ChannelIconName[] = [
  'Hash',
  'Users',
  'Wallet',
  'Wrench',
  'ShieldCheck',
  'Briefcase',
  'Megaphone',
  'BookOpen',
  'Star',
  'Globe',
];

/**
 * 8 solid desaturated colors with at least 4.5:1 contrast against white (#FFFFFF).
 * All 8 tested with contrast ratio >= 9.5:1.
 */
export const CHANNEL_COLOR_SWATCHES: { hex: string; name: string }[] = [
  { hex: '#2D3748', name: 'Slate' },
  { hex: '#1E3F35', name: 'Pine' },
  { hex: '#1B4958', name: 'Teal' },
  { hex: '#243B53', name: 'Navy' },
  { hex: '#372E54', name: 'Indigo' },
  { hex: '#4A2535', name: 'Plum' },
  { hex: '#523126', name: 'Rust' },
  { hex: '#443B22', name: 'Amber' },
];

export interface ChannelAvatarData {
  id: string;
  name: string;
  description: string;
  avatarMode: 'icon' | 'photo';
  avatarIcon: ChannelIconName;
  avatarColor: string;
  avatarPhoto: string;
}

/**
 * Normalize channel id or channel name to standard id key:
 * 'general', 'finance', 'it-support', 'executive-board'
 */
export function normalizeChannelId(idOrName: string): string {
  if (!idOrName) return 'general';
  const clean = idOrName.replace(/^#\s*/, '').trim().toLowerCase().replace(/\s+/g, '-');
  if (clean === 'general') return 'general';
  if (clean === 'finance' || clean === 'finance-team') return 'finance';
  if (clean === 'it-support' || clean === 'it' || clean === 'technical-support') return 'it-support';
  if (clean === 'executive-board' || clean === 'executive' || clean === 'board') return 'executive-board';
  return clean;
}

/**
 * Helper displayChannelName(name): Strips leading "#" and any spaces,
 * ensuring clean display for modern and older data alike.
 */
export function displayChannelName(name?: string): string {
  if (!name) return '';
  return name.replace(/^#\s*/, '').trim();
}

/**
 * Format channel display name from ID or raw name
 */
export function getChannelDisplayName(idOrName: string): string {
  const norm = normalizeChannelId(idOrName);
  switch (norm) {
    case 'general':
      return 'General';
    case 'finance':
      return 'Finance Team';
    case 'it-support':
      return 'IT Support';
    case 'executive-board':
      return 'Executive Board';
    default:
      return displayChannelName(idOrName) || 'Channel';
  }
}

/**
 * Defaults specified by prompt:
 * General = Hash, Finance Team = Wallet, IT Support = Wrench, Executive Board = ShieldCheck,
 * each with a different desaturated color. Any other channel defaults to Users.
 */
export const DEFAULT_CHANNEL_MAP: Record<string, ChannelAvatarData> = {
  general: {
    id: 'general',
    name: 'General',
    description: 'Organization-wide broadcast & staff channel',
    avatarMode: 'icon',
    avatarIcon: 'Hash',
    avatarColor: '#1E3F35', // Pine / Forest
    avatarPhoto: '',
  },
  finance: {
    id: 'finance',
    name: 'Finance Team',
    description: 'Finance & procurement team channel',
    avatarMode: 'icon',
    avatarIcon: 'Wallet',
    avatarColor: '#443B22', // Amber
    avatarPhoto: '',
  },
  'it-support': {
    id: 'it-support',
    name: 'IT Support',
    description: 'Technical support & infrastructure channel',
    avatarMode: 'icon',
    avatarIcon: 'Wrench',
    avatarColor: '#243B53', // Navy
    avatarPhoto: '',
  },
  'executive-board': {
    id: 'executive-board',
    name: 'Executive Board',
    description: 'Restricted fiduciary governance channel',
    avatarMode: 'icon',
    avatarIcon: 'ShieldCheck',
    avatarColor: '#372E54', // Indigo
    avatarPhoto: '',
  },
};

export const FALLBACK_CHANNEL_DATA: ChannelAvatarData = {
  id: 'channel',
  name: 'Channel',
  description: 'Team channel',
  avatarMode: 'icon',
  avatarIcon: 'Users',
  avatarColor: '#2D3748', // Slate
  avatarPhoto: '',
};

/**
 * Get fallback avatar data for a given channel
 */
export function getDefaultChannelAvatar(idOrName: string): ChannelAvatarData {
  const norm = normalizeChannelId(idOrName);
  if (DEFAULT_CHANNEL_MAP[norm]) {
    return { ...DEFAULT_CHANNEL_MAP[norm] };
  }
  return {
    ...FALLBACK_CHANNEL_DATA,
    id: norm,
    name: getChannelDisplayName(idOrName),
  };
}

/**
 * Resolve effective channel avatar data by combining defaults with Firestore doc
 */
export function resolveChannelAvatarData(
  idOrName: string,
  docData?: {
    id?: string;
    name?: string;
    description?: string;
    avatarMode?: string;
    avatarIcon?: string;
    avatarColor?: string;
    avatarPhoto?: string;
  } | null
): ChannelAvatarData {
  const defaults = getDefaultChannelAvatar(idOrName);
  if (!docData) return defaults;

  const validIcon = (
    docData.avatarIcon && docData.avatarIcon in CHANNEL_ICONS
      ? docData.avatarIcon
      : defaults.avatarIcon
  ) as ChannelIconName;

  const validColor = docData.avatarColor || defaults.avatarColor;
  const avatarMode = docData.avatarMode === 'photo' && docData.avatarPhoto ? 'photo' : 'icon';

  return {
    id: docData.id || defaults.id,
    name: docData.name || defaults.name,
    description: docData.description !== undefined ? docData.description : defaults.description,
    avatarMode,
    avatarIcon: validIcon,
    avatarColor: validColor,
    avatarPhoto: docData.avatarPhoto || '',
  };
}
