"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import { LEASE_RADIUS_M, type LeaseRec } from "@/lib/engine/leaseFit";

const home = L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 34],
  html: `<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 22s-7-6.3-7-12a7 7 0 0 1 14 0c0 5.7-7 12-7 12z" fill="#0d5c4b" stroke="#fff" stroke-width="1.5"/><path d="M12 6.5l1.2 2.5 2.7.3-2 1.9.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.9 2.7-.3z" fill="#fff"/></svg>` });

// Numbered square pins; the selected lease is larger and green so the map and the list stay in step.
const pinIcon = (rank: number, selected: boolean) => {
  const s = selected ? 40 : 30;
  return L.divIcon({
    className: "", iconSize: [s, s], iconAnchor: [s / 2, s / 2],
    html: `<span style="display:grid;place-items:center;width:${s}px;height:${s}px;border-radius:${selected ? 12 : 9}px;background:${selected ? "#0d5c4b" : "#15201b"};border:${selected ? 3 : 2}px solid #fff;box-shadow:0 2px 8px rgba(21,32,27,.4);color:#fff;font:700 ${selected ? 18 : 14}px var(--font-bricolage),sans-serif">${rank}</span>`,
  });
};

function Fit({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    const d = (LEASE_RADIUS_M * 1.08) / 111320, e = d / Math.cos((lat * Math.PI) / 180);
    map.fitBounds([[lat - d, lng - e], [lat + d, lng + e]]);
  }, [map, lat, lng]);
  return null;
}

type Props = { lat: number; lng: number; leases: LeaseRec[]; competitors: { id: string; lat: number; lng: number }[]; selectedId: string | null; onSelect: (id: string) => void };

export default function LeaseMap({ lat, lng, leases, competitors, selectedId, onSelect }: Props) {
  const icons = useMemo(() => Object.fromEntries(leases.map(l => [l.id, pinIcon(l.rank, l.id === selectedId)])), [leases, selectedId]);
  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-line md:h-[640px]">
      <MapContainer center={[lat, lng]} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit lat={lat} lng={lng} />
        <Circle center={[lat, lng]} radius={LEASE_RADIUS_M} pathOptions={{ color: "#0d5c4b", weight: 1.5, dashArray: "6 5", fillOpacity: 0.04 }}>
          <Tooltip permanent direction="top" offset={[0, -4]} className="!bg-transparent !border-0 !shadow-none !text-[11px] !font-semibold">3 miles</Tooltip>
        </Circle>
        {competitors.map(c => (
          <CircleMarker key={c.id} center={[c.lat, c.lng]} radius={4} interactive={false} pathOptions={{ color: "#fff", weight: 1.5, fillOpacity: 1, fillColor: "#eb6834" }} />
        ))}
        <Marker position={[lat, lng]} icon={home} zIndexOffset={2000} title="Your address"><Tooltip direction="top" offset={[0, -30]}>Your address</Tooltip></Marker>
        {leases.map(l => (
          <Marker key={l.id} position={[l.lat, l.lng]} icon={icons[l.id]} zIndexOffset={l.id === selectedId ? 1500 : 1000} title={`Lease ${l.rank}: ${l.address}`} eventHandlers={{ click: () => onSelect(l.id) }} />
        ))}
      </MapContainer>
      <div className="absolute left-3 top-3 z-[1000] grid gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs">
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-accent ring-2 ring-white" />Your address</span>
        <span className="flex items-center gap-2"><span className="mx-0.5 h-2 w-2 rounded-full" style={{ background: "#eb6834" }} />Competitors</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-ink" />Leases</span>
      </div>
    </div>
  );
}
