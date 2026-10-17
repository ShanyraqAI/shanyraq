import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { publicRulesView } from "@/lib/agreements/service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Правила проживания",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function PublicRulesPage({
  params,
}: {
  params: Promise<{ ruleId: string }>;
}) {
  if (process.env.GUEST_DOCUMENT_BUNDLES_ENABLED !== "true") notFound();
  const { ruleId } = await params;
  const rules = await publicRulesView(db, ruleId);
  if (!rules) notFound();
  return (
    <main className="min-h-dvh bg-[#f7f8f4] p-4 text-base leading-relaxed text-[#203b30] sm:p-8">
      <article className="mx-auto max-w-2xl space-y-5 rounded-2xl border bg-white p-5 sm:p-8">
        <p className="text-sm text-[#52645a]">Shanyraq · Публичные правила</p>
        <h1 className="text-2xl font-bold">Правила проживания</h1>
        <h2 className="text-lg font-semibold">{rules.propertyName}</h2>
        <p className="text-sm text-[#52645a]">
          Версия {rules.version} ·{" "}
          {new Date(rules.updatedAt).toLocaleDateString("ru-RU", {
            timeZone: "Asia/Almaty",
          })}
        </p>
        <p className="whitespace-pre-wrap break-words">{rules.text}</p>
        <p className="border-t pt-4 text-sm text-[#52645a]">
          Это общая публичная страница. Её открытие не означает принятие
          условий, подписание договора или оплату. Личные документы и условия
          вашей брони владелец передаёт отдельно.
        </p>
      </article>
    </main>
  );
}
