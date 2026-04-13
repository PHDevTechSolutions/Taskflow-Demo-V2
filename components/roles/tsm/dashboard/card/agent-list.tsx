"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Map, MapMarker, MapTileLayer } from "@/components/ui/map";
import type { LatLngExpression } from "leaflet";
import { useMap } from "react-leaflet";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, where, onSnapshot } from "firebase/firestore";
import { Clock, TruckElectric, Coins, ReceiptText, PackageCheck, PackageX, CircleOff } from "lucide-react";

interface HistoryItem {
  referenceid: string;
  start_date: string;
  end_date: string;
  actual_sales: string;
  dr_number: string;
  quotation_amount: string;
  quotation_number: string;
  so_amount: string;
  so_number: string;
  date_created: string;
  status?: string;
}

interface SiteVisit {
  Type?: string;
  Status?: string;
  date_created?: string;
  Location?: string;
  Latitude?: number | string;
  Longitude?: number | string;
  PhotoURL?: string;
  SiteVisitAccount?: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
  Position?: string;
  Status?: string;
}

interface Props {
  agent: Agent;
  agentActivities: HistoryItem[];
  referenceid?: string;
}

function FlyToLocation({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.flyTo(center, zoom, { animate: true, duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return "—";
  const cleaned = dateStr.replace(" at ", " ").replace(/ GMT.*$/, "");
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("en-PH", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
};

const formatDurationMs = (ms: number) => {
  if (ms <= 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours && `${hours}h`,
    minutes && `${minutes}m`,
    seconds && `${seconds}s`,
  ].filter(Boolean).join(" ");
};

const sumField = (field: keyof HistoryItem, items: HistoryItem[]) =>
  items.reduce((sum, item) => {
    const val = parseFloat(item[field] ?? "0");
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

const uniqueCount = (field: keyof HistoryItem, items: HistoryItem[]) =>
  new Set(items.map((i) => i[field]?.trim()).filter((v) => v && v.length > 0)).size;

const php = (val: number) =>
  val.toLocaleString("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });

export function AgentCard({ agent, agentActivities, referenceid }: Props) {
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [errorVisits, setErrorVisits] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<[number, number] | null>(null);
  const [latestLogin, setLatestLogin] = useState<string | null>(null);
  const [latestLogout, setLatestLogout] = useState<string | null>(null);

  useEffect(() => {
    if (!agent?.ReferenceID) return;
    const refId = agent.ReferenceID.trim();

    setLoadingVisits(true);
    fetch(`/api/fetch-tsa-tasklog?referenceid=${encodeURIComponent(refId)}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => setSiteVisits(d.siteVisits || []))
      .catch((e) => setErrorVisits(e.message))
      .finally(() => setLoadingVisits(false));
  }, [agent?.ReferenceID]);

  useEffect(() => {
    if (!agent?.ReferenceID) return;
    const refId = agent.ReferenceID.trim();

    const q = query(collection(db, "activity_logs"), where("ReferenceID", "==", refId), orderBy("date_created", "desc"));
    return onSnapshot(q, (snap) => {
      const fmt = (dc: any) => {
        if (!dc) return null;
        const d = dc.toDate ? dc.toDate() : new Date(dc);
        return d.toLocaleString("en-PH", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: true, timeZoneName: "short" });
      };
      setLatestLogin(fmt(snap.docs.find(d => d.data().status?.toLowerCase() === "login")?.data().date_created));
      setLatestLogout(fmt(snap.docs.find(d => d.data().status?.toLowerCase() === "logout")?.data().date_created));
    }, () => { setLatestLogin(null); setLatestLogout(null); });
  }, [agent?.ReferenceID]);

  const soDone = agentActivities.filter((i) => i.status === "SO-Done");
  const cancelled = agentActivities.filter((i) => i.status === "Cancelled");

  const totalDurationMs = agentActivities.reduce((total, item) => {
    if (!item.start_date || !item.end_date) return total;
    const s = new Date(item.start_date.replace(" ", "T")).getTime();
    const e = new Date(item.end_date.replace(" ", "T")).getTime();
    return (!isNaN(s) && !isNaN(e) && e > s) ? total + (e - s) : total;
  }, 0);

  const totalActualSales = sumField("actual_sales", agentActivities);
  const totalSoAmount = sumField("so_amount", soDone);
  const totalQuotationAmount = sumField("quotation_amount", agentActivities);
  const totalCancelledSoAmount = sumField("so_amount", cancelled);
  const countDrNumber = uniqueCount("dr_number", agentActivities);
  const countQuotationNumber = uniqueCount("quotation_number", agentActivities);
  const countSoNumber = uniqueCount("so_number", soDone);
  const countCancelledSoNumber = uniqueCount("so_number", cancelled);

  const mapMarkers = siteVisits.flatMap((visit) => {
    const lat = typeof visit.Latitude === "string" ? parseFloat(visit.Latitude) : visit.Latitude;
    const lng = typeof visit.Longitude === "string" ? parseFloat(visit.Longitude) : visit.Longitude;
    if (typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng)) {
      return [{ position: [lat, lng] as LatLngExpression, ...visit }];
    }
    return [];
  });

  const mapCenter: LatLngExpression = selectedVisit ?? (mapMarkers.length > 0 ? mapMarkers[0].position : [0, 0]);
  const mapZoom = selectedVisit ? 16 : 13;

  const isOnline = agent.Status?.toLowerCase() === "online";

  const metrics = [
    totalActualSales > 0 && {
      icon: <Coins className="w-4 h-4 text-amber-500" />,
      label: "Total Sales Invoice",
      value: php(totalActualSales),
      footer: `${countDrNumber} delivered transaction${countDrNumber !== 1 ? "s" : ""}`,
      footerIcon: <TruckElectric className="w-3.5 h-3.5 text-gray-400" />,
      color: "border-amber-100 bg-amber-50/40",
    },
    totalSoAmount > 0 && {
      icon: <PackageCheck className="w-4 h-4 text-green-600" />,
      label: "Total Sales Order",
      value: php(totalSoAmount),
      footer: `${countSoNumber} sales order${countSoNumber !== 1 ? "s" : ""}`,
      footerIcon: <PackageCheck className="w-3.5 h-3.5 text-gray-400" />,
      color: "border-green-100 bg-green-50/40",
    },
    totalCancelledSoAmount > 0 && {
      icon: <CircleOff className="w-4 h-4 text-red-500" />,
      label: "Cancelled Sales Order",
      value: php(totalCancelledSoAmount),
      footer: `${countCancelledSoNumber} cancelled order${countCancelledSoNumber !== 1 ? "s" : ""}`,
      footerIcon: <PackageX className="w-3.5 h-3.5 text-gray-400" />,
      color: "border-red-100 bg-red-50/40",
    },
    totalQuotationAmount > 0 && {
      icon: <ReceiptText className="w-4 h-4 text-indigo-500" />,
      label: "Total Quotation Amount",
      value: php(totalQuotationAmount),
      footer: `${countQuotationNumber} quotation${countQuotationNumber !== 1 ? "s" : ""}`,
      footerIcon: <ReceiptText className="w-3.5 h-3.5 text-gray-400" />,
      color: "border-indigo-100 bg-indigo-50/40",
    },
  ].filter(Boolean) as {
    icon: React.ReactNode; label: string; value: string;
    footer: string; footerIcon: React.ReactNode; color: string;
  }[];

  return (
    <Card className="rounded-xl border shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <CardHeader className="px-5 pt-5 pb-4 border-b bg-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left: Avatar + Info */}
          <div className="flex items-start gap-4">
            {/* Avatar with status dot */}
            <div className="relative flex-shrink-0">
              {agent.profilePicture ? (
                <img
                  src={agent.profilePicture}
                  alt={`${agent.Firstname} ${agent.Lastname}`}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
                  onError={(e) => { e.currentTarget.src = "/Taskflow.png"; }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-xl text-gray-400 border-2 border-white shadow-sm">
                  {agent.Firstname?.[0]}
                </div>
              )}
              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? "bg-green-500" : "bg-gray-300"}`} />
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900 uppercase leading-tight">
                {agent.Firstname} {agent.Lastname}
              </h2>
              {agent.Position && (
                <p className="text-xs text-gray-400 font-mono mt-0.5">{agent.Position}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${isOnline ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                  {agent.Status || "Offline"}
                </span>
              </div>

              {/* Login/Logout */}
              <div className="mt-2 space-y-0.5 text-[11px] text-gray-500 font-mono">
                {latestLogin && (
                  <p><span className="text-gray-400">Login: </span>{formatDateTime(latestLogin)}</p>
                )}
                {latestLogout && (
                  <p><span className="text-gray-400">Logout: </span>{formatDateTime(latestLogout)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Working Hours badge */}
          {totalDurationMs > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-center px-3 py-2 rounded-xl bg-gray-50 border text-xs font-mono text-gray-700">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Total Working: <strong>{formatDurationMs(totalDurationMs)}</strong></span>
            </div>
          )}
        </div>
      </CardHeader>

      {/* ── Content ── */}
      <CardContent className="p-4 bg-gray-50/50">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Left: Metric Cards ── */}
          <div className="flex flex-col gap-2">
            {metrics.length === 0 && (
              <div className="flex items-center justify-center h-32 rounded-xl border border-dashed text-xs text-gray-400">
                No activity data available.
              </div>
            )}
            {metrics.map((m, i) => (
              <div key={i} className={`rounded-xl border px-4 py-3 ${m.color}`}>
                <div className="flex items-center gap-2 mb-1">
                  {m.icon}
                  <span className="text-xs text-gray-500 font-medium">{m.label}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 font-mono">{m.value}</p>
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-400">
                  {m.footerIcon}
                  <span>{m.footer}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Right: Map ── */}
          <div className="relative rounded-xl border overflow-hidden min-h-[340px] bg-white shadow-sm">
            {loadingVisits && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                Loading site visits...
              </div>
            )}
            {errorVisits && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-red-500">
                {errorVisits}
              </div>
            )}
            {!loadingVisits && !errorVisits && siteVisits.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                No site visits available.
              </div>
            )}
            {!loadingVisits && !errorVisits && siteVisits.length > 0 && (
              <>
                <Map center={mapCenter} zoom={13} className="h-full w-full">
                  <MapTileLayer />
                  <FlyToLocation center={mapCenter} zoom={mapZoom} />
                  {mapMarkers.map((marker, idx) => (
                    <MapMarker key={idx} position={marker.position} />
                  ))}
                </Map>

                {/* Floating site visit panel */}
                <div className="absolute top-3 right-3 w-64 max-h-[300px] z-[9999] overflow-auto rounded-xl bg-white/80 backdrop-blur-sm shadow-lg border border-gray-100 p-3">
                  <p className="text-[11px] font-semibold text-gray-700 mb-2 text-center tracking-wide uppercase">
                    Site Visits
                  </p>
                  <ul className="space-y-1.5">
                    {siteVisits.map((visit, idx) => {
                      const lat = typeof visit.Latitude === "string" ? parseFloat(visit.Latitude) : visit.Latitude;
                      const lng = typeof visit.Longitude === "string" ? parseFloat(visit.Longitude) : visit.Longitude;
                      const hasCoords = typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng);
                      const isSelected = selectedVisit?.[0] === lat && selectedVisit?.[1] === lng;

                      return (
                        <li
                          key={idx}
                          onClick={() => hasCoords && setSelectedVisit([lat as number, lng as number])}
                          className={`rounded-lg border p-2 text-[10px] transition cursor-pointer font-mono
                            ${!hasCoords ? "opacity-40 cursor-not-allowed" : "hover:bg-indigo-50 hover:border-indigo-200"}
                            ${isSelected ? "bg-indigo-50 border-indigo-300" : "border-gray-100 bg-white"}
                          `}
                        >
                          <p className="font-semibold text-gray-700 truncate">{visit.SiteVisitAccount || "—"}</p>
                          <div className="flex gap-2 mt-0.5 text-gray-400">
                            <span>{visit.Type || "—"}</span>
                            <span>·</span>
                            <span className={visit.Status?.toLowerCase() === "completed" ? "text-green-600" : "text-gray-400"}>
                              {visit.Status || "—"}
                            </span>
                          </div>
                          <p className="text-gray-400 mt-0.5 truncate">{visit.Location || "—"}</p>
                          {visit.date_created && (
                            <p className="text-gray-300 mt-0.5">
                              {new Date(visit.date_created).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                            </p>
                          )}
                          {visit.PhotoURL && (
                            <img 
                              src={visit.PhotoURL} 
                              alt="Site" 
                              className="mt-1.5 w-full max-h-24 rounded-md object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}