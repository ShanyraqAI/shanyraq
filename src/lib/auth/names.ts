import { z } from "zod";

const namePart = z.string().trim().max(80, "Не более 80 символов")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Уберите специальные символы из имени");

export const userNameFields = {
  firstName: namePart.pipe(z.string().min(1, "Укажите имя")),
  lastName: namePart.default(""),
};

export function fullNameFromParts(name: { firstName: string; lastName: string }): string {
  return [name.firstName.trim(), name.lastName.trim()].filter(Boolean).join(" ");
}

/** Legacy accounts keep their original full name until the profile is saved. */
export function resolveUserName(user: { fullName: string; firstName?: string | null; lastName?: string | null }) {
  if (user.firstName != null) return { firstName: user.firstName, lastName: user.lastName ?? "" };
  const [legacyFirst = "", ...legacyLast] = user.fullName.trim().split(/\s+/);
  return {
    firstName: legacyFirst,
    lastName: user.lastName ?? legacyLast.join(" "),
  };
}
