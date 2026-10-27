import { useEffect, useRef, useState } from 'react';
import type { ShareDestination } from '../../../supabase/functions/_shared/share-protocol.ts';
import { newCorrelation } from '../../../supabase/functions/_shared/share-protocol.ts';
import { diagnostic } from './recipient.ts';

type MapInstance = { panTo(point: { lat: number; lng: number }): void; fitBounds(bounds: unknown): void; addListener(name: string, callback: () => void): { remove(): void } };
type Maps = { Map: new (element: HTMLElement, options: unknown) => MapInstance; LatLngBounds: new () => { extend(point: { lat: number; lng: number }): void }; marker: { AdvancedMarkerElement: new (options: unknown) => { addListener(name: string, callback: () => void): void; map: MapInstance | null } }; importLibrary(name: string): Promise<unknown> };
declare global { interface Window { google?: { maps: Maps }; gm_authFailure?: () => void; } }
let loader: Promise<Maps> | null = null;
const authFailures = new Set<() => void>();
function loadMaps(key: string): Promise<Maps> {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!loader) loader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
    if (nonce) script.nonce = nonce;
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&v=weekly&libraries=marker&loading=async';
    // Restricted browser keys need the hosting origin; never send a path,
    // query or capability in this resource's referrer.
    script.referrerPolicy = 'origin'; script.async = true;
    script.onload = () => window.google?.maps ? resolve(window.google.maps) : reject(new Error());
    script.onerror = () => reject(new Error());
    document.head.appendChild(script);
  });
  return loader;
}
export function DestinationMap({ destinations, selected, onSelect }: { destinations: ShareDestination[]; selected: string | null; onSelect(key: string): void }) {
  const element = useRef<HTMLDivElement>(null); const map = useRef<MapInstance | null>(null); const select = useRef(onSelect); select.current = onSelect;
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  useEffect(() => {
    let active = true; let settled = false; let idle: { remove(): void } | undefined;
    const markers: { map: MapInstance | null }[] = []; const correlationId = newCorrelation();
    const event = (reasonCode: string, durableOutcome: string) => diagnostic({ operation: 'SHARE_READ', stage: 'SHARE_MAP', reasonCode, durableOutcome, retryable: false, correlationId });
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; const mapId = import.meta.env.VITE_GOOGLE_MAP_ID;
    if (!key || !mapId) { setState('fallback'); event('SKIPPED', 'skipped'); return; }
    setState('loading');
    const fallback = () => { if (active && !settled) { settled = true; setState('fallback'); event('SKIPPED', 'skipped'); } };
    const authFailure = () => { if (active) { settled = false; fallback(); } };
    authFailures.add(authFailure);
    window.gm_authFailure = () => { for (const notify of authFailures) notify(); };
    const timeout = window.setTimeout(fallback, 12_000);
    event('START', 'unchanged');
    void loadMaps(key).then(async maps => {
      await maps.importLibrary('marker'); if (!active || settled || !element.current) return;
      map.current = new maps.Map(element.current, { center: { lat: 20, lng: 0 }, zoom: 2, mapId, disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative' });
      idle = map.current.addListener('idle', () => { if (active && !settled) { settled = true; window.clearTimeout(timeout); setState('ready'); event('COMPLETE', 'complete'); } });
      const bounds = new maps.LatLngBounds(); let count = 0;
      for (const destination of destinations) {
        if (!destination.centroid) continue;
        const position = { lat: destination.centroid.latitude, lng: destination.centroid.longitude }; bounds.extend(position); count++;
        const marker = new maps.marker.AdvancedMarkerElement({ map: map.current, position, title: destination.name, gmpClickable: true });
        marker.addListener('click', () => select.current(destination.key)); markers.push(marker);
      }
      if (count) map.current.fitBounds(bounds);
    }).catch(fallback);
    return () => { active = false; window.clearTimeout(timeout); authFailures.delete(authFailure); idle?.remove(); for (const marker of markers) marker.map = null; map.current = null; };
  }, [destinations]);
  useEffect(() => { const destination = destinations.find(item => item.key === selected); if (destination?.centroid) map.current?.panTo({ lat: destination.centroid.latitude, lng: destination.centroid.longitude }); }, [destinations, selected]);
  return <section className="map-panel" aria-label="Selected destination map"><div className="map-heading"><h2>The places in this highlight</h2><span>Named destinations · no routes implied</span></div><div ref={element} className="geographic-map" aria-label="Interactive geographic map" hidden={state === 'fallback'} />{state !== 'ready' && <p role="status">{state === 'loading' ? 'Opening the map…' : 'The map is unavailable. Choose any destination in the list to explore its selected memories.'}</p>}</section>;
}
