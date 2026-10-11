import { withSupabase } from 'npm:@supabase/server@1';

const MODEL = 'gpt-5.4-mini-2026-03-17';
const CONTRACT_VERSION = 'travel-life-ai-v1';
const RULE_VERSION = 'reconstruction-v1';
const MAX_INPUT_TOKENS = 2000;
const MAX_OUTPUT_TOKENS = 800;
const MAX_ALTERNATIVES = 12;
const MAX_CANDIDATES = 8;
const MAX_REQUEST_BYTES = 24_000;
const USD_RESERVATION = 0.0200;
const PROPOSAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['proposals'],
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['alternativeId', 'selectedCandidateIds', 'confidence', 'rationaleCode'],
        properties: {
          alternativeId: { type: 'string' },
          selectedCandidateIds: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['low', 'medium'] },
          rationaleCode: { type: 'string', enum: ['ambiguous-grouping', 'insufficient-evidence', 'no-proposal'] },
        },
      },
    },
  },
};

type Alternative = { id: string; kind: 'journey-group' | 'place-label'; candidateIds: string[]; relativeDayOffsets: number[]; evidenceCategories: Array<'geotagged' | 'gps-less' | 'manual'> };
type ProxyRequest = { contractVersion: typeof CONTRACT_VERSION; consentRevision: number; ruleVersion: typeof RULE_VERSION; evidenceRevision: number; correctionRevision: number; alternatives: Alternative[] };
type Proposal = { alternativeId: string; selectedCandidateIds: string[]; confidence: 'low' | 'medium'; rationaleCode: 'ambiguous-grouping' | 'insufficient-evidence' | 'no-proposal' };
type ProposalEnvelope = { status: 'proposal'; contractVersion: typeof CONTRACT_VERSION; proposals: Proposal[]; usage: { inputTokens: number | null; outputTokens: number | null } };
type SkippedEnvelope = { status: 'skipped'; reason: 'disabled' | 'unauthenticated' | 'invalid-request' | 'limited' | 'unavailable' | 'timeout' | 'refused' | 'invalid-response'; usage: { inputTokens: number | null; outputTokens: number | null } };

const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const skipped = (reason: SkippedEnvelope['reason'], usage: SkippedEnvelope['usage'] = { inputTokens: null, outputTokens: null }) => ({ status: 'skipped', reason, usage } satisfies SkippedEnvelope);
const opaqueId = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/i.test(value);
const nonNegativeInt = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const boundedUsage = (value: unknown, maximum: number) => value === undefined || (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= maximum);

async function readJsonWithinLimit(request: Request): Promise<unknown | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

export function parseRequest(value: unknown): ProxyRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const request = value as Record<string, unknown>;
  if (!exactKeys(request, ['contractVersion', 'consentRevision', 'ruleVersion', 'evidenceRevision', 'correctionRevision', 'alternatives']) || request.contractVersion !== CONTRACT_VERSION || request.ruleVersion !== RULE_VERSION || !nonNegativeInt(request.consentRevision) || !nonNegativeInt(request.evidenceRevision) || !nonNegativeInt(request.correctionRevision) || !Array.isArray(request.alternatives) || request.alternatives.length === 0 || request.alternatives.length > MAX_ALTERNATIVES) return null;
  const ids = new Set<string>();
  const alternatives: Alternative[] = [];
  for (const value of request.alternatives) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (!exactKeys(item, ['id', 'kind', 'candidateIds', 'relativeDayOffsets', 'evidenceCategories']) || !opaqueId(item.id) || (item.kind !== 'journey-group' && item.kind !== 'place-label') || !Array.isArray(item.candidateIds) || item.candidateIds.length === 0 || item.candidateIds.length > MAX_CANDIDATES || !Array.isArray(item.relativeDayOffsets) || item.relativeDayOffsets.length !== item.candidateIds.length || !Array.isArray(item.evidenceCategories) || item.evidenceCategories.length !== item.candidateIds.length) return null;
    const alternativeId = item.id as string;
    if (ids.has(alternativeId)) return null;
    const candidates = new Set<string>();
    for (let index = 0; index < item.candidateIds.length; index += 1) {
      const candidate = item.candidateIds[index];
      const offset = item.relativeDayOffsets[index];
      const category = item.evidenceCategories[index];
      if (!opaqueId(candidate) || candidates.has(candidate) || typeof offset !== 'number' || !Number.isInteger(offset) || Math.abs(offset) > 3650 || (category !== 'geotagged' && category !== 'gps-less' && category !== 'manual')) return null;
      candidates.add(candidate);
    }
    ids.add(alternativeId);
    alternatives.push({ id: alternativeId, kind: item.kind as Alternative['kind'], candidateIds: item.candidateIds as string[], relativeDayOffsets: item.relativeDayOffsets as number[], evidenceCategories: item.evidenceCategories as Alternative['evidenceCategories'] });
  }
  // A deliberately conservative byte-to-token estimate rejects bodies which could
  // exceed the hard upstream cap before any provider call.
  if (new TextEncoder().encode(JSON.stringify(request)).byteLength > MAX_INPUT_TOKENS * 4) return null;
  return { contractVersion: CONTRACT_VERSION, consentRevision: request.consentRevision as number, ruleVersion: RULE_VERSION, evidenceRevision: request.evidenceRevision as number, correctionRevision: request.correctionRevision as number, alternatives };
}

export function parseProposal(value: unknown, request: ProxyRequest): Proposal[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if (!exactKeys(envelope, ['proposals']) || !Array.isArray(envelope.proposals) || envelope.proposals.length > request.alternatives.length) return null;
  const alternatives = new Map(request.alternatives.map((alternative) => [alternative.id, alternative]));
  const seen = new Set<string>();
  const proposals: Proposal[] = [];
  for (const value of envelope.proposals) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const proposal = value as Record<string, unknown>;
    if (!exactKeys(proposal, ['alternativeId', 'selectedCandidateIds', 'confidence', 'rationaleCode']) || !opaqueId(proposal.alternativeId) || !Array.isArray(proposal.selectedCandidateIds) || proposal.selectedCandidateIds.length > MAX_CANDIDATES || (proposal.confidence !== 'low' && proposal.confidence !== 'medium') || (proposal.rationaleCode !== 'ambiguous-grouping' && proposal.rationaleCode !== 'insufficient-evidence' && proposal.rationaleCode !== 'no-proposal')) return null;
    const alternativeId = proposal.alternativeId as string;
    if (seen.has(alternativeId)) return null;
    const alternative = alternatives.get(alternativeId);
    if (!alternative) return null;
    const selected = new Set<string>();
    for (const candidate of proposal.selectedCandidateIds) if (!opaqueId(candidate) || !alternative.candidateIds.includes(candidate) || selected.has(candidate)) return null; else selected.add(candidate);
    if ((proposal.rationaleCode === 'no-proposal' || proposal.rationaleCode === 'insufficient-evidence') && selected.size !== 0) return null;
    if (proposal.rationaleCode === 'ambiguous-grouping' && selected.size === 0) return null;
    seen.add(alternativeId);
    proposals.push({ alternativeId, selectedCandidateIds: [...selected], confidence: proposal.confidence as Proposal['confidence'], rationaleCode: proposal.rationaleCode as Proposal['rationaleCode'] });
  }
  return proposals;
}

function json(value: ProposalEnvelope | SkippedEnvelope, status = 200) { return new Response(JSON.stringify(value), { status, headers }); }

export function outputText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === 'object' && !Array.isArray(part) && (part as { type?: unknown }).type === 'output_text' && typeof (part as { text?: unknown }).text === 'string') return (part as { text: string }).text;
    }
  }
  return null;
}

type FunctionContext = {
  jwtClaims?: Record<string, unknown> | null;
  userClaims?: { id?: string } | null;
  supabaseAdmin?: { rpc: (...args: any[]) => any };
};

export async function handleProxyRequest(request: Request, context?: FunctionContext) {
  if (request.method !== 'POST') return json(skipped('invalid-request'), 405);
  if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) return json(skipped('invalid-request'), 413);
  if (Deno.env.get('TRAVEL_LIFE_AI_ENABLED') !== 'true') return json(skipped('disabled'));
  const subjectId = context?.userClaims?.id;
  if (context?.jwtClaims?.is_anonymous !== true || !subjectId) return json(skipped('unauthenticated'), 401);
  const body = await readJsonWithinLimit(request);
  if (body === null) return json(skipped('invalid-request'), 400);
  const parsed = parseRequest(body);
  if (!parsed) return json(skipped('invalid-request'), 400);
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey || !context?.supabaseAdmin) return json(skipped('unavailable'));
  let reservationResult;
  try {
    reservationResult = await context.supabaseAdmin.rpc('reserve_travel_life_ai_quota', { requested_subject: subjectId, requested_input_tokens: MAX_INPUT_TOKENS, requested_output_tokens: MAX_OUTPUT_TOKENS, requested_usd: USD_RESERVATION }).single();
  } catch { return json(skipped('unavailable')); }
  const { data: reservation, error: quotaError } = reservationResult as { data: { reserved: boolean; reason: string | null } | null; error: unknown };
  if (quotaError || !reservation?.reserved) return json(skipped('limited'));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: controller.signal,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: 'Return only the requested bounded proposal. Do not infer travel facts or presence. Prefer no-proposal when evidence is insufficient.' }] },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(parsed) }] },
        ],
        text: { format: { type: 'json_schema', name: 'travel_life_proposal', strict: true, schema: PROPOSAL_SCHEMA } },
      }),
    });
    const payload = await response.json().catch(() => null) as { status?: string; usage?: { input_tokens?: number; output_tokens?: number }; error?: unknown } | null;
    if (!boundedUsage(payload?.usage?.input_tokens, MAX_INPUT_TOKENS) || !boundedUsage(payload?.usage?.output_tokens, MAX_OUTPUT_TOKENS)) return json(skipped('invalid-response'));
    const usage = { inputTokens: payload?.usage?.input_tokens ?? null, outputTokens: payload?.usage?.output_tokens ?? null };
    if (!response.ok) return json(skipped(response.status === 408 || response.status === 504 ? 'timeout' : 'unavailable', usage));
    if (payload?.status === 'incomplete') return json(skipped('refused', usage));
    const text = outputText(payload);
    if (!text) return json(skipped('refused', usage));
    let output: unknown;
    try { output = JSON.parse(text); } catch { return json(skipped('invalid-response', usage)); }
    const proposals = parseProposal(output, parsed);
    if (!proposals) return json(skipped('invalid-response', usage));
    return json({ status: 'proposal', contractVersion: CONTRACT_VERSION, proposals, usage });
  } catch (error) {
    return json(skipped(error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'unavailable'));
  } finally { clearTimeout(timeout); }
}

export default {
  fetch: withSupabase({ auth: 'user' }, (request, context) => handleProxyRequest(request, context)),
};
