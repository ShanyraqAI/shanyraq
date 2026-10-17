"use server";

import { revalidatePath } from "next/cache";
import { runMutation } from "@/server/mutation";
import type { MutationContext } from "@/lib/offline/mutation-context";
import { upsertGuestSchema, firstZodError } from "@/lib/constants";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";
import { t } from "@/lib/i18n";
import { getCurrentMembership } from "@/lib/tenant";
import { z } from "zod";

export async function addGuestNoteAction(
  input: unknown,
  context?: MutationContext,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        guestId: z.string().min(1),
        content: z.string().trim().min(1, "Введите заметку").max(2000),
      })
      .safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    return await runMutation(
      context,
      "GUESTS",
      "guest.note",
      input,
      async (db, hotelId, defer) => {
        const membership = await getCurrentMembership();
        if (!membership || membership.hotelId !== hotelId)
          return fail("Доступ запрещён");
        const guest = await db.guest.findFirst({
          where: { id: parsed.data.guestId, hotelId },
          select: { id: true },
        });
        if (!guest) return fail(t.guests.errors.guestNotFound);
        await db.guestNote.create({
          data: {
            hotelId,
            guestId: guest.id,
            authorId: membership.userId,
            content: parsed.data.content,
          },
        });
        defer(() => revalidatePath("/dashboard/guests"));
        return ok(undefined, "Заметка добавлена");
      },
    );
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function upsertGuestAction(
  input: unknown,
  context?: MutationContext,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = upsertGuestSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    return await runMutation(
      context,
      "GUESTS",
      "guest.upsert",
      input,
      async (db, hotelId, defer) => {
        const data = parsed.data;

        if (data.id) {
          const existing = await db.guest.findFirst({
            where: { id: data.id, hotelId },
          });
          if (!existing) return fail(t.guests.errors.guestNotFound);
          await db.guest.update({
            where: { id: existing.id },
            data: {
              fullName: data.fullName,
              email: data.email || null,
              phone: data.phone || null,
              country: data.country || null,
              notes: data.notes || null,
            },
          });
          defer(() => revalidatePath("/dashboard/guests"));
          return ok({ id: existing.id }, t.guests.toasts.updated);
        }

        const created = await db.guest.create({
          data: {
            hotelId,
            fullName: data.fullName,
            email: data.email || null,
            phone: data.phone || null,
            country: data.country || null,
            notes: data.notes || null,
          },
        });
        defer(() => revalidatePath("/dashboard/guests"));
        return ok({ id: created.id }, t.guests.toasts.created);
      },
    );
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
