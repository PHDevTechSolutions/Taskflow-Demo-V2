"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemFooter, ItemTitle, ItemActions, } from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import { Map, MapMarker, MapTileLayer, } from "@/components/ui/map";
import type { LatLngExpression } from "leaflet";
import { useMap } from "react-leaflet";

import { db } from "@/lib/firebase";
import { collection, query, orderBy, where, onSnapshot, } from "firebase/firestore";

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

function FlyToLocation({
  center,
  zoom,
}: {
  center: LatLngExpression;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!center) return;

    map.flyTo(center, zoom, {
      animate: true,
      duration: 0.8,
    });
  }, [center, zoom, map]);

  return null;
}

// Helper to safely parse date strings, returns ms or null
function parseDateMs(value?: string | null) {
  if (!value) return null;
  const ms = new Date(value.replace(" ", "T")).getTime();
  return isNaN(ms) ? null : ms;
}

export function AgentCard({ agent, agentActivities, referenceid }: Props) {
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [errorVisits, setErrorVisits] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<[number, number] | null>(null);

  const [latestLogin, setLatestLogin] = useState<string | null>(null);
  const [latestLogout, setLatestLogout] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<Array<{
    start_date: string | null;
    end_date: string | null;
    remarks: string | null;
    type_activity: string | null;
    date_created: string | null;
  }>>([]);

  useEffect(() => {
    if (!agent?.ReferenceID) return;

    const refId = agent.ReferenceID.trim();

    const fetchSiteVisits = async () => {
      setLoadingVisits(true);
      setErrorVisits(null);

      try {
        const res = await fetch(
          `/api/fetch-tsa-tasklog?referenceid=${encodeURIComponent(refId)}`
        );
        if (!res.ok) throw new Error("Failed to fetch site visits");
        const data = await res.json();
        setSiteVisits(data.siteVisits || []);
      } catch (err: any) {
        setErrorVisits(err.message);
      } finally {
        setLoadingVisits(false);
      }
    };

    fetchSiteVisits();
  }, [agent?.ReferenceID]);

  useEffect(() => {
    if (!agent?.ReferenceID) return;

    const refId = agent.ReferenceID.trim();

    const activityLogsQuery = query(
      collection(db, "activity_logs"),
      where("ReferenceID", "==", refId),
      orderBy("date_created", "desc")
    );

    const unsubscribe = onSnapshot(
      activityLogsQuery,
      (snapshot) => {
        const loginDoc = snapshot.docs.find(doc => doc.data().status?.toLowerCase() === "login");
        const logoutDoc = snapshot.docs.find(doc => doc.data().status?.toLowerCase() === "logout");

        const formatDate = (dateCreated: any) => {
          if (!dateCreated) return null;
          if (dateCreated.toDate) {
            return dateCreated.toDate().toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              second: 'numeric',
              hour12: true,
              timeZoneName: 'short',
            });
          } else if (typeof dateCreated === "string") {
            return new Date(dateCreated).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              second: 'numeric',
              hour12: true,
              timeZoneName: 'short',
            });
          }
          return null;
        };

        setLatestLogin(loginDoc ? formatDate(loginDoc.data().date_created) : null);
        setLatestLogout(logoutDoc ? formatDate(logoutDoc.data().date_created) : null);
      },
      (error) => {
        console.error("Firestore snapshot error:", error);
        setLatestLogin(null);
        setLatestLogout(null);
      }
    );

    return () => unsubscribe();
  }, [agent?.ReferenceID]);

  // Filter activities by status
  const soDoneActivities = agentActivities.filter(
    (item) => item.status === "SO-Done"
  );
  const cancelledActivities = agentActivities.filter(
    (item) => item.status === "Cancelled"
  );

  // Total working duration (ms) - safely parse dates
  const totalDurationMs = agentActivities.reduce((total, item) => {
    const start = parseDateMs(item.start_date);
    const end = parseDateMs(item.end_date);

    if (start !== null && end !== null && end > start) {
      return total + (end - start);
    }
    return total;
  }, 0);

  const formatDurationMs = (ms: number) => {
    if (ms <= 0) return "-";

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      hours && `${hours} hr${hours > 1 ? "s" : ""}`,
      minutes && `${minutes} min${minutes > 1 ? "s" : ""}`,
      seconds && `${seconds} sec${seconds > 1 ? "s" : ""}`,
    ]
      .filter(Boolean)
      .join(" ");
  };

  // Sum numeric fields helper
  const sumField = (field: keyof HistoryItem, items: HistoryItem[]) =>
    items.reduce((sum, item) => {
      const val = parseFloat(item[field] ?? "0");
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  const totalActualSales = sumField("actual_sales", agentActivities);
  const totalSoAmount = sumField("so_amount", soDoneActivities);
  const totalQuotationAmount = sumField("quotation_amount", agentActivities);
  const totalCancelledSoAmount = sumField("so_amount", cancelledActivities);

  // Unique count helper
  const uniqueCount = (field: keyof HistoryItem, items: HistoryItem[]) => {
    const set = new Set(
      items
        .map((item) => item[field]?.trim())
        .filter((v) => v && v.length > 0)
    );
    return set.size;
  };

  const countDrNumber = uniqueCount("dr_number", agentActivities);
  const countQuotationNumber = uniqueCount("quotation_number", agentActivities);
  const countSoNumber = uniqueCount("so_number", soDoneActivities);
  const countCancelledSoNumber = uniqueCount("so_number", cancelledActivities);

  // Prepare map markers for site visits
  const mapMarkers = siteVisits
    .map((visit) => {
      const lat = typeof visit.Latitude === "string" ? parseFloat(visit.Latitude) : visit.Latitude;
      const lng = typeof visit.Longitude === "string" ? parseFloat(visit.Longitude) : visit.Longitude;
      if (typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng)) {
        return {
          position: [lat, lng] as LatLngExpression,
          type: visit.Type,
          status: visit.Status,
          location: visit.Location,
          date_created: visit.date_created,
        };
      }
      return null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  // Default map center
  const mapCenter: LatLngExpression =
    selectedVisit ?? (mapMarkers.length > 0 ? mapMarkers[0].position : [0, 0]);
  const mapZoom = selectedVisit ? 16 : 13;

  useEffect(() => {
    if (!agent?.ReferenceID) return;

    const q = query(
      collection(db, "meetings"),
      where("referenceid", "==", agent.ReferenceID),
      orderBy("date_created", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setMeetings([]);
        return;
      }

      const formatDate = (d: any) => {
        if (!d) return null;
        if (d.toDate) return d.toDate().toLocaleString();
        if (typeof d === "string") return new Date(d).toLocaleString();
        return null;
      };

      const allMeetings = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          start_date: formatDate(data.start_date),
          end_date: formatDate(data.end_date),
          remarks: data.remarks ?? "—",
          type_activity: data.type_activity ?? "—",
          date_created: formatDate(data.date_created),
        };
      });

      setMeetings(allMeetings);
    });

    return () => unsubscribe();
  }, [agent?.ReferenceID]);

  return (
    <Card className="min-h-[160px]">
      <CardHeader className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          {agent.profilePicture ? (
            <img
              src={agent.profilePicture}
              alt={`${agent.Firstname} ${agent.Lastname}`}
              className="w-20 h-20 rounded-lg object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-xl text-gray-600">
              ?
            </div>
          )}

          <div className="flex flex-col">
            <p className="font-semibold text-lg uppercase">
              {agent.Firstname} {agent.Lastname}
            </p>
            {agent.Position && (
              <p className="text-xs text-muted-foreground font-mono mb-2">
                {agent.Position} | Target Quota: {agent.TargetQuota}
              </p>
            )}

            {agent.Status && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground font-mono">
                <Badge className="text-[8px] p-2 font-mono">{agent.Status}</Badge>

                <div className="flex flex-col leading-tight">
                  {latestLogin && (
                    <span>Latest login: {latestLogin}</span>
                  )}
                  {latestLogout && (
                    <span>Latest logout: {latestLogout}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {totalDurationMs > 0 && (
          <Badge className="p-4 font-mono">
            Total Working Hours: {formatDurationMs(totalDurationMs)}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="px-6 font-mono">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center sm:text-left">
          {/* Left column: all items except Site Visits */}
          <div className="flex flex-col gap-1">
            {totalActualSales > 0 && (
              <Item variant="outline">
                <ItemContent>
                  <ItemTitle>Total Sales Invoice:</ItemTitle>
                  <ItemDescription>
                    {totalActualSales.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </ItemDescription>
                </ItemContent>
                <ItemActions />
                <ItemFooter>
                  Total Delivered Transactions:{" "}
                  <Badge className="px-4 py-2 font-mono">{countDrNumber}</Badge>
                </ItemFooter>
              </Item>
            )}

            {totalSoAmount > 0 && (
              <Item variant="outline">
                <ItemContent>
                  <ItemTitle>Total Sales Order:</ItemTitle>
                  <ItemDescription>
                    {totalSoAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </ItemDescription>
                </ItemContent>
                <ItemActions />
                <ItemFooter>
                  Sales Orders:{" "}
                  <Badge className="px-4 py-2 font-mono">{countSoNumber}</Badge>
                </ItemFooter>
              </Item>
            )}

            {totalCancelledSoAmount > 0 && (
              <Item variant="outline" className="border-red-500">
                <ItemContent>
                  <ItemTitle>Total Cancelled Sales Order:</ItemTitle>
                  <ItemDescription className="text-red-600 font-semibold">
                    {totalCancelledSoAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </ItemDescription>
                </ItemContent>
                <ItemActions />
                <ItemFooter>
                  Cancelled Sales Orders:{" "}
                  <Badge className="px-4 py-2 font-mono">{countCancelledSoNumber}</Badge>
                </ItemFooter>
              </Item>
            )}

            {totalQuotationAmount > 0 && (
              <Item variant="outline">
                <ItemContent>
                  <ItemTitle>Total Quotation Amount:</ItemTitle>
                  <ItemDescription>
                    {totalQuotationAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </ItemDescription>
                </ItemContent>
                <ItemActions />
                <ItemFooter>
                  Quotations:{" "}
                  <Badge className="px-4 py-2 font-mono">{countQuotationNumber}</Badge>
                </ItemFooter>
              </Item>
            )}
          </div>

          <div className="relative rounded-md border overflow-hidden min-h-[350px]">
            {/* STATES */}
            {loadingVisits && (
              <div className="absolute inset-0 flex items-center justify-center text-sm">
                Loading site visits...
              </div>
            )}

            {errorVisits && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-red-600">
                {errorVisits}
              </div>
            )}

            {!loadingVisits && !errorVisits && siteVisits.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm">
                No site visits available.
              </div>
            )}

            {/* MAP */}
            {!loadingVisits && !errorVisits && siteVisits.length > 0 && (
              <>
                <Map center={mapCenter} zoom={13} className="h-full w-full">
                  <MapTileLayer />

                  <FlyToLocation center={mapCenter} zoom={mapZoom} />

                  {mapMarkers.map((marker, idx) => (
                    <MapMarker key={idx} position={marker.position} />
                  ))}
                </Map>

                <div
                  className="absolute top-4 right-4 w-72 max-h-[360px] bg-white/40 backdrop-blur-xs custom-scrollbar
                   bg-white shadow-lg
                   rounded-lg overflow-auto p-3 text-left
                   font-mono z-[9999]"
                  style={{ scrollbarGutter: "stable" }}
                >
                  <h3 className="font-semibold mb-3 text-center text-sm">
                    Site Visits
                  </h3>

                  <ul className="space-y-2">
                    {siteVisits.map((visit, idx) => {
                      const lat =
                        typeof visit.Latitude === "string"
                          ? parseFloat(visit.Latitude)
                          : visit.Latitude;

                      const lng =
                        typeof visit.Longitude === "string"
                          ? parseFloat(visit.Longitude)
                          : visit.Longitude;

                      const hasCoords =
                        typeof lat === "number" &&
                        !isNaN(lat) &&
                        typeof lng === "number" &&
                        !isNaN(lng);

                      const isSelected =
                        selectedVisit?.[0] === lat &&
                        selectedVisit?.[1] === lng;

                      return (
                        <li
                          key={idx}
                          onClick={() => hasCoords && setSelectedVisit([lat, lng])}
                          className={`
                  border rounded-md p-2 text-[10px]
                  transition cursor-pointer
                  ${hasCoords ? "hover:bg-red-50" : "opacity-50 cursor-not-allowed"}
                  ${isSelected ? "bg-red-100 border-red-400" : "border-gray-200"}
                `}
                        >
                          <p><strong>Visited On:</strong> {visit.SiteVisitAccount || "N/A"}</p>
                          <p><strong>Type:</strong> {visit.Type || "N/A"}</p>
                          <p><strong>Status:</strong> {visit.Status || "N/A"}</p>
                          <p><strong>Location:</strong> {visit.Location || "N/A"}</p>
                          <p>
                            <strong>Date:</strong>{" "}
                            {visit.date_created
                              ? new Date(visit.date_created).toLocaleString()
                              : "N/A"}
                          </p>

                          {visit.PhotoURL && (
                            <img
                              src={visit.PhotoURL}
                              alt={`Photo of ${visit.Type}`}
                              className="mt-2 w-full max-h-40 rounded-md object-cover"
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

        {/* Meetings List */}
        {meetings.length > 0 ? (
          <div className="mt-6 p-5 bg-white rounded-xl shadow-md max-h-64 overflow-auto font-mono text-sm text-gray-900">
            <h4 className="font-bold mb-4 text-green-600 border-b border-green-300 pb-2">Meetings</h4>
            <ul className="space-y-5">
              {meetings.map((meeting, idx) => (
                <li
                  key={idx}
                  className="p-4 rounded-lg border-l-4 border-green-500 bg-green-50 hover:bg-green-100 transition-colors"
                >
                  <p><strong>Start:</strong> {meeting.start_date ?? "N/A"}</p>
                  <p><strong>End:</strong> {meeting.end_date ?? "N/A"}</p>
                  <p><strong>Type:</strong> {meeting.type_activity ?? "N/A"}</p>
                  <p><strong>Remarks:</strong> {meeting.remarks ?? "N/A"}</p>
                  <p className="text-xs text-green-700"><strong>Recorded:</strong> {meeting.date_created ?? "N/A"}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <></>
        )}

      </CardContent>
    </Card>
  );
}
