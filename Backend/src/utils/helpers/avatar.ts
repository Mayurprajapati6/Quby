export function generateAvatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed.toLowerCase().replace(/\s+/g, "-"));
  return `https://api.dicebear.com/8.x/adventurer/svg?seed=${encoded}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}