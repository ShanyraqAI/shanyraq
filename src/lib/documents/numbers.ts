export function officialDocumentNumber(value: string): string {
  return /^\d+$/.test(value) ? String(Number(value)) : value;
}
