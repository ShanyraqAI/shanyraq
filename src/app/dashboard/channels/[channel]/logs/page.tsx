import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileClock } from "lucide-react";
import { db, getCurrentHotelId } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { SyncStatusBadge } from "@/components/shared/status-badge";
import { t } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ChannelLogsPage({
  params,
}: {
  params: Promise<{ channel: string }>;
}) {
  const { channel: channelId } = await params;
  const hotelId = await getCurrentHotelId();

  const channel = await db.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.isInternal) notFound();

  const logs = await db.syncLog.findMany({
    where: { channelId, connection: { hotelId } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/channels/${channelId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {channel.name}
      </Link>

      <PageHeader
        title={t.channelsPage.logs.title(channel.name)}
        description={t.channelsPage.logs.description}
      />

      {logs.length === 0 ? (
        <EmptyState
          icon={FileClock}
          title={t.channelsPage.logs.emptyTitle}
          description={t.channelsPage.logs.emptyDescription}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead>{t.channelsPage.logs.columns.started}</TableHead>
                <TableHead>{t.channelsPage.logs.columns.finished}</TableHead>
                <TableHead>{t.channelsPage.logs.columns.status}</TableHead>
                <TableHead className="text-right">{t.channelsPage.logs.columns.reservations}</TableHead>
                <TableHead className="text-right">{t.channelsPage.logs.columns.rates}</TableHead>
                <TableHead className="text-right">{t.channelsPage.logs.columns.availability}</TableHead>
                <TableHead>{t.channelsPage.logs.columns.details}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDateTime(log.startedAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {log.finishedAt ? formatDateTime(log.finishedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <SyncStatusBadge status={log.status as never} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{log.reservationsImported}</TableCell>
                  <TableCell className="text-right tabular-nums">{log.ratesUpdated}</TableCell>
                  <TableCell className="text-right tabular-nums">{log.availabilityUpdated}</TableCell>
                  <TableCell className="max-w-[360px] text-sm text-muted-foreground">
                    {log.error ? (
                      <span className="text-destructive">{log.error}</span>
                    ) : (
                      (log.message ?? "—")
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
