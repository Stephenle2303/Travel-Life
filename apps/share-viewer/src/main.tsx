import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createRecipientClient, takeCapability } from './recipient.ts';
import { DestinationMap } from './destination-map.tsx';
import type { Recipient } from './recipient.ts';
import './style.css';

const capability = takeCapability(window.location, window.history);
const environment = import.meta.env;
const client = capability ? createRecipientClient(environment.VITE_SHARE_READ_ENDPOINT ?? '', environment.VITE_SUPABASE_PUBLISHABLE_KEY ?? '', capability) : null;
// A fragment navigation does not reload an SPA. Remove the previous recipient
// surface synchronously, then let a fresh document consume the new capability.
window.addEventListener('hashchange', () => {
  document.getElementById('root')?.replaceChildren();
  window.location.reload();
});
function Media({ recipient, mediaKey }: { recipient: Recipient; mediaKey: string }) {
  const [url, setUrl] = useState<string | null>(null); const [unavailable, setUnavailable] = useState(false);
  const media = recipient.snapshot.media.find(item => item.key === mediaKey)!;
  useEffect(() => { let active = true; let objectUrl: string | null = null; void client?.media(recipient.snapshot.version, mediaKey).then(blob => { if (!active) return; if (!blob || blob.type !== media.mimeType || blob.size !== media.byteLength) { setUnavailable(true); return; } objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [recipient.snapshot.version, mediaKey, media.mimeType, media.byteLength]);
  return <figure>{url ? media.kind === 'photo' ? <img src={url} alt={media.caption || 'Selected travel memory'} /> : <video src={url} controls playsInline preload="metadata" aria-label={media.caption || 'Selected travel video'} /> : <p role="status">{unavailable ? 'This memory is unavailable.' : 'Opening selected memory…'}</p>}{media.caption && <figcaption>{media.caption}</figcaption>}</figure>;
}
function App() {
  const [recipient, setRecipient] = useState<Recipient | null>(null); const [loading, setLoading] = useState(!!client); const [selected, setSelected] = useState<string | null>(null); const [message, setMessage] = useState('');
  useEffect(() => { let active = true; void client?.snapshot().then(value => { if (active) { setRecipient(value); setSelected(value?.snapshot.chapters[0]?.destinationKey ?? null); setLoading(false); } }); return () => { active = false; }; }, []);
  const destinations = useMemo(() => recipient ? [...recipient.snapshot.destinations].sort((a, b) => a.date === null ? b.date === null ? 0 : 1 : b.date === null ? -1 : a.date.value.localeCompare(b.date.value)) : [], [recipient]);
  async function share(copy: boolean) {
    if (!capability || !recipient) return;
    const url = location.origin + location.pathname + '#' + capability;
    try { if (!copy && navigator.share) await navigator.share({ title: 'A Travel Life highlight', url }); else await navigator.clipboard.writeText(url); setMessage(copy ? 'Link copied. Anyone with it can open or forward it.' : 'Share handoff ended.'); }
    catch { setMessage('Link sharing did not finish. You can try again.'); }
  }
  const createYours = /^https:\/\//.test(environment.VITE_CREATE_YOURS_URL ?? '') ? environment.VITE_CREATE_YOURS_URL : null;
  return <main><header><a className="brand" href="/">TRAVEL LIFE<span>Shared with care</span></a><span className="pill">Selected highlight</span></header>{loading ? <section className="unavailable"><p role="status">Opening selected highlight…</p></section> : !recipient ? <section className="unavailable"><p className="eyebrow">Private by choice</p><h1>This highlight is unavailable.</h1><p>The link may no longer be available. Ask the person who shared it for a new link.</p>{createYours && <a className="button" href={createYours} rel="noreferrer">Create yours</a>}</section> : <>
    <section className="intro"><p className="eyebrow">A little of their world</p><h1>{recipient.snapshot.title}</h1><p>{recipient.snapshot.summary.destinationCount} selected destinations · {recipient.snapshot.summary.mediaCount} selected memories</p><p className="quiet">Available until {new Date(recipient.expiresAt).toLocaleDateString()}. Inferred destinations remain labeled.</p></section>
    <div className="atlas"><DestinationMap destinations={destinations} selected={selected} onSelect={setSelected} />
    <section className="timeline" aria-label="Chronological destination timeline"><h2>The selected story</h2>{destinations.map(item => <button key={item.key} className={'destination ' + (selected === item.key ? 'selected' : '')} onClick={() => setSelected(item.key)} aria-pressed={selected === item.key}><span>{item.date ? item.date.value + ' · ' + item.date.precision + ' precision' : 'Date unknown'}</span><strong>{item.name}</strong><span>{item.country}{item.country ? ' · ' : ''}{item.status === 'inferred' ? 'Inferred' : 'Confirmed'}</span></button>)}</section></div>
    <section className="memories"><h2>{destinations.find(item => item.key === selected)?.name ?? 'Selected memories'}</h2><div className="media-grid">{recipient.snapshot.chapters.find(chapter => chapter.destinationKey === selected)?.mediaKeys.map(key => <Media recipient={recipient} mediaKey={key} key={recipient.snapshot.version + key} />)}{!recipient.snapshot.chapters.find(chapter => chapter.destinationKey === selected)?.mediaKeys.length && <p>This destination was shared without media.</p>}</div></section>
    <footer><p>Anyone with this link can open or forward it. Saved copies cannot be removed.</p><div className="actions"><button onClick={() => void share(true)}>Copy link</button>{!!navigator.share && <button onClick={() => void share(false)}>Share link</button>}{createYours && <a className="button" href={createYours} rel="noreferrer">Create yours</a>}</div><p role="status">{message}</p></footer>
  </>}</main>;
}
createRoot(document.getElementById('root')!).render(<App />);
