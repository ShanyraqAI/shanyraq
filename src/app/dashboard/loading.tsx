export default function DashboardLoading() {
  return <main className="grid min-h-[70vh] place-items-center bg-[#f7f8f5]" role="status" aria-label="Загрузка"><span className="relative grid size-12 place-items-center"><span className="absolute inset-0 animate-ping rounded-full bg-[#07866b]/10" /><span className="size-8 animate-spin rounded-full border-[3px] border-[#07866b]/15 border-t-[#07866b]" /></span></main>;
}
