"use client";

import React, { useEffect, useState } from "react";
import { type DateRange } from "react-day-picker";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import MarkerClusterGroup from "react-leaflet-cluster";
import {
    Map,
    MapMarker,
    MapPopup,
    MapTileLayer,
    MapZoomControl,
    MapLocateControl,
} from "@/components/ui/map";

interface SiteVisit {
    Type?: string;
    Status?: string;
    date_created?: string;
    Location?: string;
    Latitude?: number | string;
    Longitude?: number | string;
    PhotoURL?: string;
}

interface SiteVisitCardProps {
    referenceid: string;
    dateRange?: DateRange;
}

import dynamic from "next/dynamic";

const SiteVisitMap = dynamic(
    () => import("./dashboard-site-visit-map"),
    { ssr: false }
);


export function SiteVisitCard({ referenceid, dateRange }: SiteVisitCardProps) {
    const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!referenceid) return;

        const fetchSiteVisits = async () => {
            setLoading(true);
            setError(null);
            try {
                const url = `/api/fetch-tasklog?referenceid=${encodeURIComponent(referenceid)}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error("Failed to fetch site visits");
                const data = await res.json();
                setSiteVisits(data.siteVisits || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSiteVisits();
    }, [referenceid]);

    // Filter site visits by date range if provided
    const filteredVisits = siteVisits.filter((visit) => {
        if (!dateRange || !dateRange.from || !dateRange.to) return true;
        if (!visit.date_created) return false;
        const visitDate = new Date(visit.date_created);
        return visitDate >= dateRange.from && visitDate <= dateRange.to;
    });

    // Default map center (fallback)
    const defaultCenter: [number, number] = [14.5995, 120.9842]; // Manila lat/lng fallback

    // Calculate center based on first available site's coords, or fallback
    const mapCenter: [number, number] =
        filteredVisits.length > 0 &&
            filteredVisits[0].Latitude != null &&
            filteredVisits[0].Longitude != null
            ? [
                Number(filteredVisits[0].Latitude),
                Number(filteredVisits[0].Longitude),
            ]
            : defaultCenter;



    return (
        <Card className="bg-white text-black z-10">
            <CardHeader>
                <CardTitle>Site Visits</CardTitle>
                <CardDescription>Showing site visits on the map from TaskLog collection</CardDescription>
            </CardHeader>

            <CardContent className="h-[400px]">
                {loading && <p className="text-sm text-gray-500">Loading site visits...</p>}
                {error && <p className="text-sm text-red-500">{error}</p>}

                {!loading && !error && filteredVisits.length === 0 && (
                    <p className="text-sm text-gray-500">No site visits found.</p>
                )}

                {!loading && !error && filteredVisits.length > 0 && (
                    <SiteVisitMap
                        visits={filteredVisits}
                        center={mapCenter}
                    />
                )}
            </CardContent>
            <CardFooter className="text-muted-foreground text-xs">
                Displays site visits on a map including location, status, and photos.
            </CardFooter>
        </Card>
    );
}
