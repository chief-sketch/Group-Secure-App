/**
 * Accessible 8 desaturated color swatches for avatar initials
 * Text colors are carefully matched to guarantee WCAG AA contrast (> 4.5:1, typically > 7:1)
 */
export interface AvatarColorSwatch {
  id: string;
  hex: string;
  text: string;
  border: string;
  name: string;
}

export const AVATAR_COLOR_SWATCHES: AvatarColorSwatch[] = [
  { id: 'emerald', hex: '#1C443C', text: '#E6F7F2', border: 'rgba(0, 168, 132, 0.4)', name: 'Restrained Emerald' },
  { id: 'slate', hex: '#2D3748', text: '#F7FAFC', border: 'rgba(203, 213, 225, 0.35)', name: 'Deep Slate' },
  { id: 'amber', hex: '#543D1A', text: '#FEF3C7', border: 'rgba(245, 158, 11, 0.4)', name: 'Warm Amber' },
  { id: 'indigo', hex: '#3B3554', text: '#EDE9FE', border: 'rgba(196, 181, 253, 0.35)', name: 'Muted Indigo' },
  { id: 'rose', hex: '#502A35', text: '#FFE4E6', border: 'rgba(253, 164, 175, 0.35)', name: 'Dusk Rose' },
  { id: 'cyan', hex: '#1E3E4A', text: '#E0F2FE', border: 'rgba(56, 189, 248, 0.35)', name: 'Steel Cyan' },
  { id: 'bronze', hex: '#4A3528', text: '#FFEDD5', border: 'rgba(251, 146, 60, 0.35)', name: 'Dark Bronze' },
  { id: 'olive', hex: '#2C3E26', text: '#DCFCE7', border: 'rgba(74, 222, 128, 0.35)', name: 'Forest Olive' },
];

/**
 * Compute stable desaturated colors for user avatars based on name/email or a custom selected hex
 */
export function getAvatarColor(name: string, customHex?: string): { bg: string; text: string; border: string } {
  if (customHex) {
    const matched = AVATAR_COLOR_SWATCHES.find(
      (s) => s.hex.toLowerCase() === customHex.toLowerCase() || s.id.toLowerCase() === customHex.toLowerCase()
    );
    if (matched) {
      return { bg: matched.hex, text: matched.text, border: matched.border };
    }
    return { bg: customHex, text: '#FFFFFF', border: 'rgba(255, 255, 255, 0.2)' };
  }

  let hash = 0;
  const str = (name || '').trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLOR_SWATCHES.length;
  const swatch = AVATAR_COLOR_SWATCHES[index];
  return { bg: swatch.hex, text: swatch.text, border: swatch.border };
}

/**
 * Extract 1-2 character initials from display name
 */
export function getInitials(name: string): string {
  if (!name) return 'U';
  const clean = name.replace(/@.*$/, '').trim();
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
