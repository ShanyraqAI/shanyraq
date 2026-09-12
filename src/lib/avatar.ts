export function isManagedAvatar(value: string | null | undefined): value is string {
  return Boolean(value?.includes(".blob.vercel-storage.com/"));
}

export function avatarDisplayUrl(userId: string, storedUrl: string | null | undefined): string | null {
  if (!storedUrl) return null;
  return isManagedAvatar(storedUrl) ? `/api/avatar/${encodeURIComponent(userId)}` : storedUrl;
}
