import { CalendarDays, ClipboardList, FileDown, ShieldCheck, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { DataExportDialog } from "@/components/exports/data-export-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { firstAllowedDashboardPath, resolveHotelPermissions, type HotelPermission } from "@/lib/access";
import { addDays, toISODate, todayInTimeZone } from "@/lib/dates";
import { getCurrentHotel, getCurrentMembership } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const EXPORT_PERMISSIONS = ["REPORTS", "CALENDAR", "RESERVATIONS", "GUESTS"] as const satisfies readonly HotelPermission[];

export default async function ExportsPage() {
  const [membership, hotel] = await Promise.all([getCurrentMembership(), getCurrentHotel()]);
  if (!membership || !hotel) redirect("/login");

  const permissions = resolveHotelPermissions(membership);
  const available = EXPORT_PERMISSIONS.filter((permission) => permissions.includes(permission));
  if (available.length === 0) redirect(firstAllowedDashboardPath(permissions));

  const currentDate = todayInTimeZone(hotel.timezone);
  const from = toISODate(addDays(currentDate, -29));
  const to = toISODate(currentDate);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Экспорт"
        description="Скачивайте данные текущего отеля для анализа, печати или резервного хранения."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {available.includes("REPORTS") ? (
          <ExportCard
            icon={FileDown}
            title="Отчёт по показателям"
            description="Загрузка, выручка, ADR и RevPAR по дням за выбранный период."
          >
            <DataExportDialog dataset="reports" defaultFrom={from} defaultTo={to} maxTo={to} />
          </ExportCard>
        ) : null}

        {available.includes("CALENDAR") ? (
          <ExportCard
            icon={CalendarDays}
            title="Календарь"
            description="Активные бронирования за выбранный период до 367 дней."
          >
            <DataExportDialog dataset="calendar" defaultFrom={from} defaultTo={to} />
          </ExportCard>
        ) : null}

        {available.includes("RESERVATIONS") ? (
          <ExportCard
            icon={ClipboardList}
            title="Бронирования"
            description="Полный список бронирований со статусами, гостями, суммами и источниками."
          >
            <DataExportDialog dataset="reservations" />
          </ExportCard>
        ) : null}

        {available.includes("GUESTS") ? (
          <ExportCard
            icon={Users}
            title="Гости"
            description="Гостевая база, контакты и краткая история проживания."
          >
            <DataExportDialog dataset="guests" />
          </ExportCard>
        ) : null}
      </div>

      <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>Экспорт содержит только данные текущего отеля и учитывает ваши права доступа. Файлы формируются по запросу и не сохраняются на сервере.</p>
      </div>
    </div>
  );
}

function ExportCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof FileDown;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
