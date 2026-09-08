const AVATAR_TONES = ['var(--primary)', 'var(--success)', 'var(--violet)', 'var(--info)', 'var(--warning)'];

export function avatarTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}
