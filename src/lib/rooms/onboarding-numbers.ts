/** Bounded, deterministic naming; duplicates cannot spin the server event loop. */
export function onboardingNumbers(first: string, count: number, existing: string[]): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("Некорректное количество квартир");
  const used = new Set(existing.map((n) => n.toLocaleLowerCase("ru-RU")));
  if (count === 1) {
    if (used.has(first.toLocaleLowerCase("ru-RU"))) throw new Error("Квартира с таким названием уже существует");
    return [first];
  }
  const suffix = first.match(/^(.*?)(\d+)$/);
  const prefix = suffix?.[1] ?? `${first} `;
  let next = suffix ? Number(suffix[2]) : 1;
  if (!Number.isSafeInteger(next) || next < 0) throw new Error("Числовой суффикс названия слишком большой");
  const result: string[] = [];
  const maxAttempts = existing.length + count;
  for (let attempt = 0; attempt < maxAttempts && result.length < count; attempt++) {
    if (!Number.isSafeInteger(next)) throw new Error("Числовой суффикс названия слишком большой");
    const candidate = `${prefix}${next++}`;
    if (candidate.length > 80) throw new Error("Название квартиры слишком длинное");
    const normalized = candidate.toLocaleLowerCase("ru-RU");
    if (used.has(normalized)) continue;
    used.add(normalized);
    result.push(candidate);
  }
  if (result.length !== count) throw new Error("Не удалось подобрать уникальные названия квартир");
  return result;
}
