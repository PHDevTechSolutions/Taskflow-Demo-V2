"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemFooter, ItemTitle } from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import { Map, MapMarker, MapTileLayer } from "@/components/ui/map";
import type { LatLngExpression } from "leaflet";
import { useMap } from "react-leaflet";
import { MapPin, Clock, CalendarDays } from "lucide-react";

import { db } from "@/lib/firebase";
import { collection, query, orderBy, where, onSnapshot } from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryItem {
  referenceid: string;
  start_date: string | null;
  end_date: string | null;
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
  Role: string;
  TargetQuota: string;
}

interface Props {
  agent: Agent;
  agentActivities: HistoryItem[];
  referenceid?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// FIX: defined once outside component — stable, no closure issues
function formatFirestoreDate(dateCreated: any): string | null {
  if (!dateCreated) return null;
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: true, timeZoneName: "short",
  };
  if (dateCreated.toDate) return dateCreated.toDate().toLocaleString("en-US", options);
  if (typeof dateCreated === "string") return new Date(dateCreated).toLocaleString("en-US", options);
  return null;
}

function parseDateMs(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value.replace(" ", "T")).getTime();
  return isNaN(ms) ? null : ms;
}

function formatDurationMs(ms: number): string {
  if (ms <= 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours   && `${hours}hr`,
    minutes && `${minutes}min`,
    seconds && `${seconds}sec`,
  ].filter(Boolean).join(" ");
}

function sumField(field: keyof HistoryItem, items: HistoryItem[]): number {
  return items.reduce((sum, item) => {
    const val = parseFloat((item[field] as string) ?? "0");
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

function uniqueCount(field: keyof HistoryItem, items: HistoryItem[]): number {
  return new Set(
    items.map((item) => (item[field] as string)?.trim()).filter((v) => v && v.length > 0)
  ).size;
}

function toMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── FlyTo Helper ─────────────────────────────────────────────────────────────

function FlyToLocation({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.flyTo(center, zoom, { animate: true, duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentCard({ agent, agentActivities }: Props) {
  const [siteVisits, setSiteVisits]     = useState<SiteVisit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [errorVisits, setErrorVisits]   = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<[number, number] | null>(null);

  const [latestLogin, setLatestLogin]   = useState<string | null>(null);
  const [latestLogout, setLatestLogout] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<Array<{
    start_date: string | null;
    end_date: string | null;
    remarks: string | null;
    type_activity: string | null;
    date_created: string | null;
  }>>([]);

  // ── Site visits ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!agent?.ReferenceID) return;
    const refId = agent.ReferenceID.trim();

    setLoadingVisits(true);
    setErrorVisits(null);

    fetch(`/api/fetch-tsa-tasklog?referenceid=${encodeURIComponent(refId)}`)
      .then((res) => { if (!res.ok) throw new Error("Failed to fetch site visits"); return res.json(); })
      .then((data) => setSiteVisits(data.siteVisits || []))
      .catch((err) => setErrorVisits(err.message))
      .finally(() => setLoadingVisits(false));
  }, [agent?.ReferenceID]);

  // ── Login / logout ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!agent?.ReferenceID) return;
    const refId = agent.ReferenceID.trim();

    const q = query(
      collection(db, "activity_logs"),
      where("ReferenceID", "==", refId),
      orderBy("date_created", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loginDoc  = snapshot.docs.find((d) => d.data().status?.toLowerCase() === "login");
        const logoutDoc = snapshot.docs.find((d) => d.data().status?.toLowerCase() === "logout");
        setLatestLogin(loginDoc  ? formatFirestoreDate(loginDoc.data().date_created)  : null);
        setLatestLogout(logoutDoc ? formatFirestoreDate(logoutDoc.data().date_created) : null);
      },
      (err) => { console.error("Firestore error:", err); }
    );

    return () => unsub();
  }, [agent?.ReferenceID]);

  // ── Meetings ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!agent?.ReferenceID) return;

    const q = query(
      collection(db, "meetings"),
      where("referenceid", "==", agent.ReferenceID),
      orderBy("date_created", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setMeetings(
        snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            start_date:    formatFirestoreDate(d.start_date),
            end_date:      formatFirestoreDate(d.end_date),
            remarks:       d.remarks       ?? "—",
            type_activity: d.type_activity ?? "—",
            date_created:  formatFirestoreDate(d.date_created),
          };
        })
      );
    });

    return () => unsub();
  }, [agent?.ReferenceID]);

  // ── Derived stats ───────────────────────────────────────────────────────
  const soDoneActivities      = agentActivities.filter((i) => i.status === "SO-Done");
  const cancelledActivities   = agentActivities.filter((i) => i.status === "Cancelled");

  const totalDurationMs = agentActivities.reduce((total, item) => {
    const start = parseDateMs(item.start_date);
    const end   = parseDateMs(item.end_date);
    return (start !== null && end !== null && end > start) ? total + (end - start) : total;
  }, 0);

  const totalActualSales        = sumField("actual_sales", agentActivities);
  const totalSoAmount           = sumField("so_amount", soDoneActivities);
  const totalQuotationAmount    = sumField("quotation_amount", agentActivities);
  const totalCancelledSoAmount  = sumField("so_amount", cancelledActivities);

  const countDrNumber           = uniqueCount("dr_number", agentActivities);
  const countQuotationNumber    = uniqueCount("quotation_number", agentActivities);
  const countSoNumber           = uniqueCount("so_number", soDoneActivities);
  const countCancelledSoNumber  = uniqueCount("so_number", cancelledActivities);

  // ── Map markers ─────────────────────────────────────────────────────────
  const mapMarkers = siteVisits
    .map((visit) => {
      const lat = typeof visit.Latitude  === "string" ? parseFloat(visit.Latitude)  : visit.Latitude;
      const lng = typeof visit.Longitude === "string" ? parseFloat(visit.Longitude) : visit.Longitude;
      if (typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng)) {
        return { position: [lat, lng] as LatLngExpression, ...visit, lat, lng };
      }
      return null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const mapCenter: LatLngExpression =
    selectedVisit ?? (mapMarkers.length > 0 ? mapMarkers[0].position : [14.5995, 120.9842]);
  const mapZoom = selectedVisit ? 16 : 13;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Card>
      {/* ── Header ── */}
      <CardHeader className="flex flex-col gap-2 pb-2">
        <div className="flex flex-wrap items-center gap-3">
          {totalDurationMs > 0 && (
            <Badge className="ml-auto flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs">
              <Clock size={12} /> Working Hours: {formatDurationMs(totalDurationMs)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-6 flex flex-col gap-6">

        {/* ── Stats + Map ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Stats */}
          <div className="flex flex-col gap-3">
            {totalActualSales > 0 && (
              <Item variant="outline">
                <ItemContent>
                  <ItemTitle className="text-xs text-gray-500">Total Sales Invoice</ItemTitle>
                  <ItemDescription className="text-base font-bold text-gray-800">
                    ₱{toMoney(totalActualSales)}
                  </ItemDescription>
                </ItemContent>
                <ItemFooter className="text-xs text-gray-500">
                  Delivered Transactions: <Badge className="ml-1 px-2 py-0.5 text-xs">{countDrNumber}</Badge>
                </ItemFooter>
              </Item>
            )}

            {totalSoAmount > 0 && (
              <Item variant="outline">
                <ItemContent>
                  <ItemTitle className="text-xs text-gray-500">Total Sales Order</ItemTitle>
                  <ItemDescription className="text-base font-bold text-gray-800">
                    ₱{toMoney(totalSoAmount)}
                  </ItemDescription>
                </ItemContent>
                <ItemFooter className="text-xs text-gray-500">
                  Sales Orders: <Badge className="ml-1 px-2 py-0.5 text-xs">{countSoNumber}</Badge>
                </ItemFooter>
              </Item>
            )}

            {totalCancelledSoAmount > 0 && (
              <Item variant="outline" className="border-red-300">
                <ItemContent>
                  <ItemTitle className="text-xs text-red-500">Total Cancelled Sales Order</ItemTitle>
                  <ItemDescription className="text-base font-bold text-red-600">
                    ₱{toMoney(totalCancelledSoAmount)}
                  </ItemDescription>
                </ItemContent>
                <ItemFooter className="text-xs text-gray-500">
                  Cancelled Orders: <Badge className="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-700">{countCancelledSoNumber}</Badge>
                </ItemFooter>
              </Item>
            )}

            {totalQuotationAmount > 0 && (
              <Item variant="outline">
                <ItemContent>
                  <ItemTitle className="text-xs text-gray-500">Total Quotation Amount</ItemTitle>
                  <ItemDescription className="text-base font-bold text-gray-800">
                    ₱{toMoney(totalQuotationAmount)}
                  </ItemDescription>
                </ItemContent>
                <ItemFooter className="text-xs text-gray-500">
                  Quotations: <Badge className="ml-1 px-2 py-0.5 text-xs">{countQuotationNumber}</Badge>
                </ItemFooter>
              </Item>
            )}

            {/* Empty stats state */}
            {totalActualSales === 0 && totalSoAmount === 0 &&
              totalCancelledSoAmount === 0 && totalQuotationAmount === 0 && (
              <div className="flex items-center justify-center h-full py-10 text-xs text-gray-400 italic">
                No activity data for the selected period.
              </div>
            )}
          </div>

          {/* Map */}
          <div className="relative rounded-lg border overflow-hidden min-h-[350px] bg-gray-50">
            {loadingVisits && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                Loading site visits...
              </div>
            )}

            {!loadingVisits && errorVisits && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-red-500">
                {errorVisits}
              </div>
            )}

            {!loadingVisits && !errorVisits && siteVisits.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                <MapPin size={28} className="opacity-30" />
                <p className="text-xs">No site visits recorded.</p>
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

                {/* Site visits list overlay */}
                <div className="absolute top-3 right-3 w-64 max-h-[320px] z-[9999]
                  bg-white/90 backdrop-blur-sm rounded-lg shadow-lg overflow-auto
                  border border-gray-200 p-3 font-mono">
                  <h3 className="text-xs font-bold text-center mb-2 text-gray-700 border-b pb-1">
                    Site Visits ({siteVisits.length})
                  </h3>
                  <ul className="space-y-2">
                    {siteVisits.map((visit, idx) => {
                      const lat = typeof visit.Latitude  === "string" ? parseFloat(visit.Latitude)  : visit.Latitude;
                      const lng = typeof visit.Longitude === "string" ? parseFloat(visit.Longitude) : visit.Longitude;
                      const hasCoords = typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng);
                      const isSelected = selectedVisit?.[0] === lat && selectedVisit?.[1] === lng;

                      return (
                        <li
                          key={idx}
                          onClick={() => hasCoords && setSelectedVisit([lat as number, lng as number])}
                          className={`rounded-md p-2 text-[10px] border transition-colors
                            ${hasCoords ? "cursor-pointer hover:bg-green-50 hover:border-green-300" : "opacity-50 cursor-not-allowed"}
                            ${isSelected ? "bg-green-100 border-green-400" : "border-gray-200"}`}
                        >
                          <p><span className="font-semibold">Account:</span> {visit.SiteVisitAccount || "N/A"}</p>
                          <p><span className="font-semibold">Type:</span>    {visit.Type     || "N/A"}</p>
                          <p><span className="font-semibold">Status:</span>  {visit.Status   || "N/A"}</p>
                          <p><span className="font-semibold">Location:</span>{visit.Location || "N/A"}</p>
                          <p><span className="font-semibold">Date:</span>    {visit.date_created ? new Date(visit.date_created).toLocaleDateString() : "N/A"}</p>
                          {visit.PhotoURL && (
                            <img
                              src={visit.PhotoURL}
                              alt={visit.Type}
                              className="mt-2 w-full max-h-32 rounded object-cover"
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

        {/* ── Meetings ── */}
        {meetings.length > 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-green-200 bg-green-100">
              <CalendarDays size={14} className="text-green-600" />
              <h4 className="text-sm font-bold text-green-700">
                Meetings <span className="font-normal text-xs text-green-500">({meetings.length})</span>
              </h4>
            </div>
            <ul className="divide-y divide-green-100 max-h-64 overflow-auto font-mono text-xs">
              {meetings.map((meeting, idx) => (
                <li key={idx} className="px-5 py-3 hover:bg-green-100 transition-colors">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-700">
                    <p><span className="font-semibold text-gray-500">Type:</span>    {meeting.type_activity ?? "N/A"}</p>
                    <p><span className="font-semibold text-gray-500">Recorded:</span> {meeting.date_created  ?? "N/A"}</p>
                    <p><span className="font-semibold text-gray-500">Start:</span>   {meeting.start_date    ?? "N/A"}</p>
                    <p><span className="font-semibold text-gray-500">End:</span>     {meeting.end_date      ?? "N/A"}</p>
                    <p className="col-span-2"><span className="font-semibold text-gray-500">Remarks:</span> {meeting.remarks ?? "N/A"}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}