type ShareDate = Readonly<{ value: string; precision: 'day' | 'month' | 'year' }>;
type InputFact = Readonly<{ key: string; label: string; date: ShareDate | null; status: 'inferred' | 'confirmed'; selected: boolean }>;
type InputMedia = Readonly<{ key: string; kind: 'photo' | 'video'; mimeType: 'image/jpeg' | 'video/mp4' | string; selected: boolean }>;

export type SharePreview = Readonly<{
  schemaVersion: 'travel-life-share-v1';
  title: string;
  facts: readonly (Readonly<{ key: string; label: string; date: ShareDate | null; status: 'inferred' | 'confirmed' }>)[];
  media: readonly (Readonly<{ key: string; kind: 'photo' | 'video'; mimeType: 'image/jpeg' | 'video/mp4' }>)[];
}>;

const safeText = (value: string, max: number) => value.length > 0 && value.length <= max && !/[<>\u0000-\u001f]/.test(value);
const opaque = (value: string) => /^[A-Za-z0-9_-]{1,128}$/.test(value);

/** Creates only the public-safe shape; source media paths and IDs never enter it. */
export function buildSharePreview(input: Readonly<{ title: string; facts: readonly InputFact[]; media: readonly InputMedia[] }>): SharePreview {
  if (!safeText(input.title, 120)) throw new Error('Share preview is invalid.');
  const facts = input.facts.filter((fact) => fact.selected).map((fact) => {
    if (!opaque(fact.key) || !safeText(fact.label, 200) || fact.date && (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(fact.date.value) || !['day', 'month', 'year'].includes(fact.date.precision))) throw new Error('Share preview is invalid.');
    return { key: fact.key, label: fact.label, date: fact.date, status: fact.status };
  });
  const media = input.media.filter((item) => item.selected).map((item) => {
    if (!opaque(item.key) || (item.kind === 'photo' && item.mimeType !== 'image/jpeg') || (item.kind === 'video' && item.mimeType !== 'video/mp4')) throw new Error('Share preview is invalid.');
    return { key: item.key, kind: item.kind, mimeType: item.mimeType as 'image/jpeg' | 'video/mp4' };
  });
  return Object.freeze({ schemaVersion: 'travel-life-share-v1', title: input.title, facts: Object.freeze(facts), media: Object.freeze(media) });
}
