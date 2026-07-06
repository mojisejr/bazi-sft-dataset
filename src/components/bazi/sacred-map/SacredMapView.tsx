"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, Marker } from "leaflet";

import { ELEMENT_COLOR, isSupportedElement, type SacredLocationDto } from "@/lib/bazi/sacred-map/constants";

type Props = {
  locations: SacredLocationDto[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** โหมดเลือกพิกัด (แอดมิน): คลิกแผนที่เพื่อปักหมุด */
  onPick?: (lat: number, lng: number) => void;
  pick?: { lat: number; lng: number } | null;
};

const BANGKOK: [number, number] = [13.7466, 100.5348];

function pinHtml(color: string, active: boolean): string {
  const scale = active ? 1.25 : 1;
  return `<span class="sacred-map__pin-dot" style="--pin:${color};transform:scale(${scale})"></span>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** หมุดแบบการ์ดเล็ก (รูป + ชื่อ) — ใช้ตอนสถานที่มีรูป; ขอบสีตามธาตุ */
function cardHtml(color: string, imageUrl: string, name: string, active: boolean): string {
  const scale = active ? 1.08 : 1;
  return `<div class="sacred-map__pin-card${active ? " sacred-map__pin-card--active" : ""}" style="--pin:${color};transform:scale(${scale})">` +
    `<img class="sacred-map__pin-card-img" src="${escapeHtml(imageUrl)}" alt="" loading="lazy" />` +
    `<span class="sacred-map__pin-card-name">${escapeHtml(name)}</span>` +
    `</div>`;
}

export default function SacredMapView({ locations, selectedId, onSelect, onPick, pick }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const pickMarkerRef = useRef<Marker | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const fittedRef = useRef(false);

  // init map ครั้งเดียว
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      lRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true }).setView(BANGKOK, 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
      pickMarkerRef.current = null;
    };
  }, []);

  // วาดหมุดเมื่อ locations/selected เปลี่ยน
  useEffect(() => {
    const L = lRef.current;
    const group = markersRef.current;
    const map = mapRef.current;
    if (!ready || !L || !group || !map) return;

    group.clearLayers();
    const pts: [number, number][] = [];
    for (const loc of locations) {
      const color = isSupportedElement(loc.element) ? ELEMENT_COLOR[loc.element] : "#8b5cf6";
      const active = loc.id === selectedId;
      const hasCard = Boolean(loc.imageUrl);
      const icon = hasCard
        ? L.divIcon({
            className: "sacred-map__pin",
            html: cardHtml(color, loc.imageUrl as string, loc.name, active),
            iconSize: [104, 86],
            iconAnchor: [52, 86],
          })
        : L.divIcon({
            className: "sacred-map__pin",
            html: pinHtml(color, active),
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
      const marker = L.marker([loc.lat, loc.lng], { icon, title: loc.name });
      marker.on("click", () => onSelect?.(loc.id));
      marker.addTo(group);
      pts.push([loc.lat, loc.lng]);
    }

    if (pts.length && !fittedRef.current && !onPick) {
      fittedRef.current = true;
      if (pts.length === 1) map.setView(pts[0], 15);
      else map.fitBounds(pts, { padding: [40, 40] });
    }
  }, [ready, locations, selectedId, onSelect, onPick]);

  // pan ไปหมุดที่เลือก
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedId) return;
    const loc = locations.find((l) => l.id === selectedId);
    if (loc) map.panTo([loc.lat, loc.lng]);
  }, [ready, selectedId, locations]);

  // โหมดเลือกพิกัด (แอดมิน)
  useEffect(() => {
    const L = lRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !onPick) return;

    const place = (lat: number, lng: number) => {
      if (pickMarkerRef.current) {
        pickMarkerRef.current.setLatLng([lat, lng]);
      } else {
        const icon = L.divIcon({
          className: "sacred-map__pin",
          html: pinHtml("#f97316", true),
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
        pickMarkerRef.current = marker;
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          onPick(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
        });
      }
    };

    const handler = (e: { latlng: { lat: number; lng: number } }) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      place(lat, lng);
      onPick(lat, lng);
    };
    map.on("click", handler);
    if (pick) {
      place(pick.lat, pick.lng);
      map.setView([pick.lat, pick.lng], 15);
    }
    return () => {
      map.off("click", handler);
    };
  }, [ready, onPick, pick]);

  return <div ref={containerRef} className="sacred-map__canvas" />;
}
