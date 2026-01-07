"use client";

import {
    Map,
    MapMarker,
    MapPopup,
    MapTileLayer,
    MapZoomControl,
    MapLocateControl,
} from "@/components/ui/map";

import MarkerClusterGroup from "react-leaflet-cluster";

interface SiteVisit {
    Type?: string;
    Status?: string;
    date_created?: string;
    Location?: string;
    Latitude?: number | string;
    Longitude?: number | string;
}

interface Props {
    visits: SiteVisit[];
    center: [number, number];
}

export default function SiteVisitMap({ visits, center }: Props) {
    return (
        <Map
            center={center}
            zoom={12}
            maxZoom={19}   // ✅ FIX HERE
            minZoom={4}    // optional
            className="w-full h-full rounded"
        >
            <MapTileLayer
                maxZoom={19}
                attribution="&copy; OpenStreetMap contributors"
            />

            <MapZoomControl />
            <MapLocateControl />

            <MarkerClusterGroup chunkedLoading>
                {visits.map((visit, idx) => {
                    if (visit.Latitude == null || visit.Longitude == null) return null;

                    const position: [number, number] = [
                        Number(visit.Latitude),
                        Number(visit.Longitude),
                    ];

                    return (
                        <MapMarker key={idx} position={position}>
                            <MapPopup>
                                <div className="max-w-xs text-left">
                                    <p><strong>Type:</strong> {visit.Type || "-"}</p><br />
                                    <p><strong>Status:</strong> {visit.Status || "-"}</p><br />
                                    <p><strong>Date:</strong> {visit.date_created
                                        ? new Date(visit.date_created).toLocaleString()
                                        : "-"}</p><br />
                                    <p><strong>Location:</strong> {visit.Location || "-"}</p>
                                </div>
                            </MapPopup>
                        </MapMarker>
                    );
                })}
            </MarkerClusterGroup>
        </Map>
    );
}
