"use server";

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
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
  verifyRegistrationSchema,
  passwordResetSchema,
  firstZodError,
} from "@/lib/constants";
import { t } from "@/lib/i18n";
import { fullNameFromParts } from "@/lib/auth/names";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";
import { PublicError } from "@/server/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { sendPasswordResetCode, sendRegistrationCode } from "@/lib/email";
import { prepareProfileImage } from "@/lib/profile-image";
import { recordAnalyticsEvent, recordAnalyticsEventSafely } from "@/lib/analytics/service";

const EMAIL_CODE_TTL_MS = 10 * 60_000;
const EMAIL_CODE_RESEND_MS = 60_000;
const MAX_CODE_ATTEMPTS = 5;

function verificationSecret(): string {
  const secret = process.env.VERIFICATION_CODE_SECRET;
  if (!secret || secret.length < 32) throw new PublicError("Подтверждение почты не настроено. Обратитесь к администратору.");
  return secret;
}

function codeHash(email: string, code: string): string {
  return createHmac("sha256", verificationSecret()).update(`${email}:${code}`).digest("hex");
}

function passwordResetCodeHash(email: string, code: string): string {
  return createHmac("sha256", verificationSecret()).update(`password-reset:${email}:${code}`).digest("hex");
}

function codesEqual(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(actual, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function createAccount(
  tx: Prisma.TransactionClient,
  input: { firstName?: string | null; lastName?: string | null; fullName: string; passwordHash: string; email?: string; phone?: string; emailVerifiedAt?: Date },
) {
  const user = await tx.user.create({
    data: {
      fullName: input.fullName,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      passwordHash: input.passwordHash,
      emailVerifiedAt: input.emailVerifiedAt ?? null,
    },
    select: { id: true },
  });
  const organization = await tx.organization.create({ data: { name: `${input.fullName} — Организация` } });
  const hotel = await tx.hotel.create({
    data: {
      orgId: organization.id,
      slug: `hotel-${randomUUID()}`,
      name: `Отель ${input.fullName.split(" ")[0]}`,
      timezone: "Asia/Almaty",
      currency: "KZT",
      country: "Казахстан",
    },
  });
  await tx.membership.create({
    data: { organizationId: organization.id, userId: user.id, hotelId: hotel.id, role: "OWNER", accessLevel: "FULL" },
  });
  await recordAnalyticsEvent({
    eventType: "signup_completed",
    userId: user.id,
    organizationId: organization.id,
    hotelId: hotel.id,
    entityType: "User",
    entityId: user.id,
  }, tx);
  await recordAnalyticsEvent({
    eventType: "hotel_created",
    userId: user.id,
    organizationId: organization.id,
    hotelId: hotel.id,
    entityType: "Hotel",
    entityId: hotel.id,
  }, tx);
  return { ...user, organizationId: organization.id, hotelId: hotel.id };
}

export async function registerAction(input: unknown): Promise<ActionResult<{ verificationRequired: boolean; email?: string }>> {
  try {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    await ensureDatabaseReady();

    const { firstName, lastName, fullName, password, method, email, phone } = parsed.data;
    await enforceRateLimit("registration", email ?? phone ?? "unknown", 4, 60 * 60_000);

    if (method === "email" && email) {
      const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) return fail(t.auth.errors.emailTaken);
      const code = String(randomInt(100_000, 1_000_000));
      const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
      const registration = await db.emailRegistration.upsert({
        where: { email },
        create: { email, firstName, lastName, fullName, passwordHash: await hashPassword(password), codeHash: codeHash(email, code), expiresAt },
        update: { firstName, lastName, fullName, passwordHash: await hashPassword(password), codeHash: codeHash(email, code), attempts: 0, expiresAt, lastSentAt: new Date() },
        select: { id: true },
      });
      await sendRegistrationCode(email, fullName, code, `${registration.id}-${expiresAt.getTime()}`);
      return ok({ verificationRequired: true, email }, "Код подтверждения отправлен на почту");
    }

    const normalizedPhone = normalizePhone(phone ?? "");
    const existing = await db.user.findUnique({ where: { phone: normalizedPhone }, select: { id: true } });
    if (existing) return fail(t.auth.errors.phoneTaken);
    const passwordHash = await hashPassword(password);
    const user = await db.$transaction((tx) => createAccount(tx, {
      fullName,
      firstName,
      lastName,
      phone: normalizedPhone,
      passwordHash,
    }));
    await createSession(user.id);
    return ok({ verificationRequired: false });
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function verifyRegistrationCodeAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = verifyRegistrationSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    await ensureDatabaseReady();
    const { email, code } = parsed.data;
    await enforceRateLimit("registration-code", email, 8, 15 * 60_000);

    const pending = await db.emailRegistration.findUnique({ where: { email } });
    if (!pending) return fail("Регистрация не найдена. Заполните форму заново.");
    if (pending.expiresAt <= new Date()) return fail("Срок действия кода истёк. Запросите новый код.");
    if (pending.attempts >= MAX_CODE_ATTEMPTS) return fail("Превышено число попыток. Запросите новый код.");

    if (!codesEqual(pending.codeHash, codeHash(email, code))) {
      await db.emailRegistration.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
      return fail("Неверный код подтверждения");
    }

    const user = await db.$transaction(async (tx) => {
      const duplicate = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (duplicate) throw new PublicError(t.auth.errors.emailTaken);
      const invitations = await tx.hotelInvitation.findMany({
        where: { email, status: "PENDING", expiresAt: { gt: new Date() } },
      });
      const created = invitations.length > 0
        ? await tx.user.create({
            data: {
              fullName: pending.fullName,
            firstName: pending.firstName,
            lastName: pending.lastName,
              email,
              emailVerifiedAt: new Date(),
              passwordHash: pending.passwordHash,
              onboardingCompleted: true,
            },
            select: { id: true },
          })
        : await createAccount(tx, {
            fullName: pending.fullName,
            firstName: pending.firstName,
            lastName: pending.lastName,
            email,
            emailVerifiedAt: new Date(),
            passwordHash: pending.passwordHash,
          });
      if (invitations.length > 0) {
        await tx.membership.createMany({
          data: invitations.map((invitation) => ({
            organizationId: invitation.organizationId,
            hotelId: invitation.hotelId,
            userId: created.id,
            role: "STAFF",
            accessLevel: invitation.accessLevel,
            permissions: invitation.permissions,
          })),
          skipDuplicates: true,
        });
        await tx.hotelInvitation.updateMany({
          where: { id: { in: invitations.map((invitation) => invitation.id) } },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
        for (const invitationItem of invitations) {
          await tx.auditLog.create({
            data: {
              hotelId: invitationItem.hotelId,
              actor: "user",
              actorUserId: created.id,
              action: "staff.invitation_accepted",
              entity: "User",
              entityId: created.id,
              metaJson: JSON.stringify({ name: pending.fullName, email }),
              newValueJson: JSON.stringify({ email, permissions: invitationItem.permissions }),
            },
          });
          const owners = await tx.membership.findMany({ where: { hotelId: invitationItem.hotelId, role: "OWNER" }, select: { userId: true } });
          await tx.notification.createMany({
            data: owners.map((owner) => ({ hotelId: invitationItem.hotelId, recipientUserId: owner.userId, type: "STAFF", title: `${pending.fullName} принял(а) приглашение`, body: email, href: "/dashboard/settings", dedupeKey: `invitation-accepted:${invitationItem.id}` })),
            skipDuplicates: true,
          });
        }
        const invitation = invitations[0];
        await recordAnalyticsEvent({
          eventType: "signup_completed",
          userId: created.id,
          organizationId: invitation.organizationId,
          hotelId: invitation.hotelId,
          entityType: "User",
          entityId: created.id,
        }, tx);
      }
      await tx.emailRegistration.delete({ where: { id: pending.id } });
      return created;
    });

    await createSession(user.id);
    return ok(undefined, "Почта подтверждена");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function resendRegistrationCodeAction(emailInput: unknown): Promise<ActionResult> {
  try {
    const parsed = verifyRegistrationSchema.shape.email.safeParse(emailInput);
    if (!parsed.success) return fail("Некорректный email");
    const email = parsed.data;
    await enforceRateLimit("registration-resend", email, 3, 10 * 60_000);
    const pending = await db.emailRegistration.findUnique({ where: { email } });
    if (!pending) return fail("Регистрация не найдена. Заполните форму заново.");
    if (Date.now() - pending.lastSentAt.getTime() < EMAIL_CODE_RESEND_MS) {
      return fail("Новый код можно запросить через минуту");
    }
    const code = String(randomInt(100_000, 1_000_000));
    const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
    await db.emailRegistration.update({
      where: { id: pending.id },
      data: { codeHash: codeHash(email, code), attempts: 0, expiresAt, lastSentAt: new Date() },
    });
    await sendRegistrationCode(email, pending.fullName, code, `${pending.id}-${expiresAt.getTime()}`);
    return ok(undefined, "Новый код отправлен");
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
    await enforceRateLimit("login", identifier, 6, 15 * 60_000);

    const user = await db.user.findUnique({
      where: isEmail
        ? { email: identifier.toLowerCase() }
        : { phone: normalizePhone(identifier) },
      select: {
        id: true,
        passwordHash: true,
        emailVerifiedAt: true,
        memberships: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { organizationId: true, hotelId: true },
        },
      },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return fail(t.auth.errors.invalidCredentials);
    }
    if (isEmail && !user.emailVerifiedAt) {
      return fail("Подтвердите email перед входом в аккаунт");
    }

    const sessionId = await createSession(user.id);
    await recordAnalyticsEventSafely({
      eventType: "login",
      userId: user.id,
      organizationId: user.memberships[0]?.organizationId,
      hotelId: user.memberships[0]?.hotelId,
      sessionId,
      metadata: { method: "password" },
    });
    return ok(undefined);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function requestPasswordResetAction(emailInput: unknown): Promise<ActionResult> {
  const genericMessage = "Если аккаунт существует, код восстановления отправлен на почту";
  try {
    const parsed = verifyRegistrationSchema.shape.email.safeParse(emailInput);
    if (!parsed.success) return fail("Некорректный email");
    const email = parsed.data;
    await enforceRateLimit("password-reset-request", email, 3, 15 * 60_000);
    const user = await db.user.findUnique({ where: { email }, select: { id: true, fullName: true, emailVerifiedAt: true } });
    if (!user?.emailVerifiedAt) return ok(undefined, genericMessage);

    const code = String(randomInt(100_000, 1_000_000));
    const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
    const reset = await db.passwordReset.upsert({
      where: { userId: user.id },
      create: { userId: user.id, codeHash: passwordResetCodeHash(email, code), expiresAt },
      update: { codeHash: passwordResetCodeHash(email, code), attempts: 0, expiresAt, lastSentAt: new Date() },
      select: { id: true },
    });
    await sendPasswordResetCode(email, user.fullName, code, `${reset.id}-${expiresAt.getTime()}`);
    return ok(undefined, genericMessage);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = passwordResetSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const { email, code, password } = parsed.data;
    await enforceRateLimit("password-reset-code", email, 8, 15 * 60_000);
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, passwordReset: true },
    });
    const reset = user?.passwordReset;
    if (!user || !reset || reset.expiresAt <= new Date() || reset.attempts >= MAX_CODE_ATTEMPTS) {
      return fail("Код недействителен или истёк. Запросите новый код.");
    }
    if (!codesEqual(reset.codeHash, passwordResetCodeHash(email, code))) {
      await db.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
      return fail("Неверный код подтверждения");
    }

    const passwordHash = await hashPassword(password);
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      db.session.deleteMany({ where: { userId: user.id } }),
      db.passwordReset.delete({ where: { id: reset.id } }),
    ]);
    await createSession(user.id);
    return ok(undefined, "Пароль изменён. Все прежние сессии завершены.");
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
        fullName: fullNameFromParts(parsed.data),
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl || null } : {}),
      },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard", "layout");
    return ok(undefined, t.account.saved);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function uploadAvatarAction(formData: FormData): Promise<ActionResult<string>> {
  try {
    const current = await getSessionUser();
    if (!current) return fail("Требуется вход в аккаунт");
    const file = formData.get("avatar");
    if (!(file instanceof File)) return fail("Выберите изображение");
    const avatarUrl = await prepareProfileImage(file);
    await db.user.update({ where: { id: current.id }, data: { avatarUrl } });
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/settings");
    return ok(avatarUrl, "Фото профиля сохранено");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
