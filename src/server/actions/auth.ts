"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/bootstrap";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession, getSessionUser } from "@/lib/auth/session";
import {
  loginSchema,
  normalizePhone,
  profileSchema,
  registerSchema,
  firstZodError,
} from "@/lib/constants";
import { t } from "@/lib/i18n";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";

export async function registerAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    await ensureDatabaseReady();

    const { fullName, password, method, email, phone } = parsed.data;

    if (method === "email" && email) {
      const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) return fail(t.auth.errors.emailTaken);
    }
    if (method === "phone" && phone) {
      const normalized = normalizePhone(phone);
      const existing = await db.user.findUnique({ where: { phone: normalized }, select: { id: true } });
      if (existing) return fail(t.auth.errors.phoneTaken);
    }

    const user = await db.user.create({
      data: {
        fullName,
        email: method === "email" ? email : null,
        phone: method === "phone" ? normalizePhone(phone ?? "") : null,
        passwordHash: await hashPassword(password),
      },
      select: { id: true },
    });

    await createSession(user.id);
    return ok(undefined);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function loginAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    await ensureDatabaseReady();

    const { identifier, password } = parsed.data;
    const isEmail = identifier.includes("@");

    const user = await db.user.findUnique({
      where: isEmail
        ? { email: identifier.toLowerCase() }
        : { phone: normalizePhone(identifier) },
      select: { id: true, passwordHash: true },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return fail(t.auth.errors.invalidCredentials);
    }

    await createSession(user.id);
    return ok(undefined);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function signOutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  try {
    const current = await getSessionUser();
    if (!current) return fail("Требуется вход в аккаунт");

    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));

    await db.user.update({
      where: { id: current.id },
      data: {
        fullName: parsed.data.fullName,
        avatarUrl: parsed.data.avatarUrl || null,
      },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard", "layout");
    return ok(undefined, t.account.saved);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
