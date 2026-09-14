import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-48" /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3"><Skeleton className="h-52 rounded-xl xl:col-span-1" /><Skeleton className="h-52 rounded-xl" /><Skeleton className="h-52 rounded-xl" /></div>
      <div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
    </div>
  );
}
