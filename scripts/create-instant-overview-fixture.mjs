/** Creates an isolated router/cache test fixture. It is NOT the production app. */
import { readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const target = process.argv[2] && path.resolve(process.argv[2]);
if (!target || target === root || target.startsWith(root + path.sep)) throw new Error("Pass an empty fixture directory OUTSIDE the repository.");
try { await access(path.join(target, "package.json")); throw new Error("Refusing to overwrite an existing fixture/package"); } catch (error) { if (error.code !== "ENOENT") throw error; }
async function write(name, content) { const file = path.join(target, name); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, content); }
for (const name of ["src/lib/offline/read-resource.ts", "src/lib/offline/read-snapshots.ts", "src/lib/dashboard/overview-types.ts", "src/lib/dashboard/overview-validation.ts", "src/components/dashboard/overview-workspace.tsx"]) {
  const file = path.join(target, name); await mkdir(path.dirname(file), { recursive: true }); await copyFile(path.join(root, name), file);
}
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
await write("package.json", JSON.stringify({ private: true, dependencies: {
  next: pkg.dependencies.next, react: pkg.dependencies.react, "react-dom": pkg.dependencies["react-dom"], zod: pkg.dependencies.zod,
  typescript: pkg.devDependencies.typescript, "@types/react": pkg.devDependencies["@types/react"], "@types/react-dom": pkg.devDependencies["@types/react-dom"], "@types/node": pkg.devDependencies["@types/node"],
} }, null, 2));
await write("src/lib/offline/outbox.ts", 'export const ACTIVE_SCOPE_KEY = "shanyraq-active-device-scope";');
await write("src/lib/access.ts", 'export type HotelPermission = "OVERVIEW" | "CALENDAR" | "RESERVATIONS";');
await write("src/lib/stats.ts", `export interface DashboardDayPoint { date: Date; value: number; count: number; total: number }
export interface DashboardStats { totalRooms:number; occupiedTonight:number; occupancyTonight:number; availableRoomsTonight:number; activeReservations:number; activeReservationsByStatus:{PENDING:number;CONFIRMED:number;CHECKED_IN:number}; inHouseGuests:number; revenueMonthToDate:number; revenueNightsMonthToDate:number; roomsCleaning:number }
export interface ChannelHealthRow {channelId:string;connectionId:string|null;status:"CONNECTED"|"DISCONNECTED"|"ERROR";lastSyncAt:Date|null;lastSyncStatus:string|null;lastError:string|null;mappedRooms:number;mappedRates:number}`);
await write("src/lib/types.ts", 'export interface ReservationVM {id:string;[key:string]:unknown}');
await write("src/components/dashboard/overview-view.tsx", `"use client";
import {useState} from "react";
import type {OverviewCore} from "@/lib/dashboard/overview-types";
export function OverviewView({core}:{core:OverviewCore;[key:string]:unknown}) {const [draft,setDraft]=useState("");return <section data-overview-content><h1>Overview fixture</h1><p data-testid="revenue">{core.stats.revenueMonthToDate}</p><input aria-label="overview draft" value={draft} onChange={e=>setDraft(e.target.value)}/></section>}`);
await write("src/app/layout.tsx", 'export default function Layout({children}:{children:React.ReactNode}) {return <html><body>{children}</body></html>}');
await write("src/app/dashboard/layout.tsx", `import Link from "next/link";
import {OverviewWorkspace,OverviewOutlet} from "@/components/dashboard/overview-workspace";
import {overviewScope} from "@/lib/dashboard/overview-types";
export default function Layout({children}:{children:React.ReactNode}) {const permissions=["OVERVIEW","CALENDAR","RESERVATIONS"] as const;return <OverviewWorkspace context={{scope:overviewScope("u","o","h","OWNER",permissions),deviceScope:"u:h",day:"2026-10-16",locale:"ru",permissions:[...permissions]}}><nav><Link href="/dashboard">Обзор</Link> <Link href="/dashboard/calendar">Календарь</Link> <Link href="/dashboard/reservations">Бронирования</Link></nav><OverviewOutlet>{children}</OverviewOutlet></OverviewWorkspace>}`);
await write("src/app/dashboard/page.tsx", 'export default function Page(){return null;}');
await write("src/app/dashboard/calendar/page.tsx", 'export const dynamic="force-dynamic";export default async function Page(){await new Promise(r=>setTimeout(r,150));return <section><h1>Calendar fixture</h1><input aria-label="calendar draft" defaultValue=""/></section>}');
await write("src/app/dashboard/reservations/page.tsx", 'export const dynamic="force-dynamic";export default function Page(){return <h1>Reservations fixture</h1>}');
await write("src/fixture-core.json", await readFile(new URL("./fixtures/instant-overview-core.json", import.meta.url), "utf8"));
await write("src/app/api/dashboard/overview/route.ts", `import core from "@/fixture-core.json";
import {overviewScope} from "@/lib/dashboard/overview-types";
export const dynamic="force-dynamic";
export async function GET(request:Request){const block=new URL(request.url).searchParams.get("block");return Response.json({scope:overviewScope("u","o","h","OWNER",["OVERVIEW","CALENDAR","RESERVATIONS"]),params:JSON.stringify(["2026-10-16","ru"]),version:'"fixture-v1"',data:block==="core"?core:[]})}`);
await write("tsconfig.json", JSON.stringify({ compilerOptions: {target:"ES2022",lib:["dom","dom.iterable","esnext"],strict:true,skipLibCheck:true,noEmit:true,module:"esnext",moduleResolution:"bundler",jsx:"react-jsx",resolveJsonModule:true,esModuleInterop:true,plugins:[{name:"next"}],paths:{"@/*":["./src/*"]}},include:["next-env.d.ts","src/**/*.ts","src/**/*.tsx",".next/types/**/*.ts"],exclude:["node_modules"]}, null, 2));
await write("next.config.mjs", 'export default { turbopack: { root: import.meta.dirname } };');
console.log(`Fixture created: ${target}. Install its dependencies, run next build and next start. Auth, API, domain types and view are explicit test substitutes.`);
