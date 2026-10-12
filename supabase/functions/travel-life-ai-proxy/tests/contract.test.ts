import { handleProxyRequest, outputText, parseProposal, parseRequest } from '../index.ts';

const request = {
  contractVersion: 'travel-life-ai-v1', consentRevision: 1, ruleVersion: 'reconstruction-v1', evidenceRevision: 2, correctionRevision: 3,
  alternatives: [{ id: 'a_0', kind: 'journey-group', candidateIds: ['c_0', 'c_1'], relativeDayOffsets: [0, 2], evidenceCategories: ['geotagged', 'gps-less'] }],
};

function adminFor(reserved = true, settled: Record<string, unknown>[] = [], opened: Record<string, unknown>[] = [], settleResult: () => unknown = () => ({ data: null, error: null })) {
  return {
    rpc: (name: string, args?: Record<string, unknown>) => {
      if (name === 'settle_travel_life_ai_attempt') {
        settled.push({ name, ...args });
        return Promise.resolve(settleResult());
      }
      return { single: async () => {
      if (name === 'reserve_travel_life_ai_quota') return { data: { reserved, reason: reserved ? null : 'daily-budget-limit' }, error: null };
      if (name === 'open_travel_life_ai_attempt') { opened.push({ name, ...args }); return { data: 42, error: null }; }
      throw new Error(`unexpected RPC ${name}`);
      } };
    },
  };
}

Deno.test('rejects private or arbitrary request fields before a provider call', () => {
  if (parseRequest({ ...request, filename: 'private.jpg' }) !== null) throw new Error('extra private field was accepted');
  if (parseRequest({ ...request, alternatives: [{ ...request.alternatives[0], candidateIds: ['c_0'], relativeDayOffsets: [0], evidenceCategories: ['geotagged'], latitude: 13.7 }] }) !== null) throw new Error('nested private field was accepted');
});

Deno.test('proposal references remain bounded to supplied opaque candidates', () => {
  const parsed = parseRequest(request);
  if (!parsed) throw new Error('synthetic fixture was rejected');
  if (parseProposal({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_not_supplied'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'possible-grouping' }] }, parsed) !== null) throw new Error('unknown candidate was accepted');
  if (parseProposal({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0', 'c_1'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'possible-grouping' }] }, parsed) === null) throw new Error('valid bounded proposal was rejected');
  if (parseProposal({ proposals: [] }, parsed) !== null) throw new Error('empty proposal envelope was accepted');
  if (parseProposal({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'possible-grouping' }] }, parsed) !== null) throw new Error('partial grouping was accepted');
  if (parseProposal({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0', 'c_1'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'possible-grouping', text: 'model-written' }] }, parsed) !== null) throw new Error('extra proposal field was accepted');
  if (parseProposal({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0'], confidence: 'low', rationaleCode: 'ambiguous-grouping' }] }, parsed) !== null) throw new Error('missing label was accepted');
  if (parseProposal({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'unknown' }] }, parsed) !== null) throw new Error('unsupported label was accepted');
  if (parseProposal({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'no-suggestion' }] }, parsed) !== null) throw new Error('mismatched label was accepted');
});

Deno.test('extracts only an explicit Responses output_text item', () => {
  if (outputText({ output: [{ content: [{ type: 'output_text', text: '{"proposals":[]}' }] }] }) !== '{"proposals":[]}') throw new Error('output text was not extracted');
  if (outputText({ output: [{ content: [{ type: 'refusal', refusal: 'no' }] }] }) !== null) throw new Error('refusal was treated as a proposal');
});

Deno.test('kill switch skips before reading a provider credential or request body', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'false');
  try {
    const response = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: 'not-json' }));
    const body = await response.json() as { status: string; reason: string };
    if (body.status !== 'skipped' || body.reason !== 'disabled') throw new Error('kill switch did not stop before provider work');
  } finally {
    Deno.env.delete('TRAVEL_LIFE_AI_ENABLED');
  }
});

Deno.test('requires a validated anonymous context before a provider call', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true');
  Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('provider must not be called'); };
  try {
    const response = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }));
    const body = await response.json() as { status: string; reason: string };
    if (body.status !== 'skipped' || body.reason !== 'unauthenticated') throw new Error('anonymous context gate failed');
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete('TRAVEL_LIFE_AI_ENABLED');
    Deno.env.delete('OPENAI_API_KEY');
  }
});

Deno.test('uses store false only after anonymous validation and a successful reservation', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true');
  Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch;
  let providerUsedStoreFalse = false;
  globalThis.fetch = async (_input, init) => {
    providerUsedStoreFalse = (JSON.parse(String(init?.body)) as { store?: unknown }).store === false;
    return new Response(JSON.stringify({
      status: 'completed',
      usage: { input_tokens: 12, output_tokens: 4 },
      output: [{ content: [{ type: 'output_text', text: JSON.stringify({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0', 'c_1'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'possible-grouping' }] }) }] }],
    }));
  };
  try {
    const response = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }), {
      jwtClaims: { is_anonymous: true },
      userClaims: { id: '00000000-0000-0000-0000-000000000001' },
      supabaseAdmin: adminFor(),
    });
    const body = await response.json() as { status: string };
    if (body.status !== 'proposal' || !providerUsedStoreFalse) throw new Error('bounded provider invocation contract failed');
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete('TRAVEL_LIFE_AI_ENABLED');
    Deno.env.delete('OPENAI_API_KEY');
  }
});

Deno.test('a failed quota reservation does not invoke the provider', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true');
  Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('provider must not be called'); };
  try {
    const response = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }), {
      jwtClaims: { is_anonymous: true },
      userClaims: { id: '00000000-0000-0000-0000-000000000001' },
      supabaseAdmin: adminFor(false),
    });
    const body = await response.json() as { status: string; reason: string };
    if (body.status !== 'skipped' || body.reason !== 'limited') throw new Error('quota fallback failed');
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete('TRAVEL_LIFE_AI_ENABLED');
    Deno.env.delete('OPENAI_API_KEY');
  }
});

Deno.test('quota exceptions and oversized streamed bodies fail closed before provider work', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true');
  Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('provider must not be called'); };
  const context = {
    jwtClaims: { is_anonymous: true },
    userClaims: { id: '00000000-0000-0000-0000-000000000001' },
    supabaseAdmin: { rpc: () => ({ single: async () => { throw new Error('database offline'); } }) },
  };
  try {
    const quotaFailure = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }), context);
    if ((await quotaFailure.json() as { reason: string }).reason !== 'unavailable') throw new Error('quota exception did not become unavailable');
    const oversized = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: 'x'.repeat(24_001) }), context);
    if ((await oversized.json() as { reason: string }).reason !== 'invalid-request') throw new Error('oversized body was not rejected');
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete('TRAVEL_LIFE_AI_ENABLED');
    Deno.env.delete('OPENAI_API_KEY');
  }
});

Deno.test('invalid provider usage is not returned to the client', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true');
  Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: -1, output_tokens: 999999 }, output: [] }));
  try {
    const response = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }), {
      jwtClaims: { is_anonymous: true }, userClaims: { id: '00000000-0000-0000-0000-000000000001' },
      supabaseAdmin: adminFor(),
    });
    if ((await response.json() as { reason: string }).reason !== 'invalid-response') throw new Error('invalid usage was returned');
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete('TRAVEL_LIFE_AI_ENABLED');
    Deno.env.delete('OPENAI_API_KEY');
  }
});

Deno.test('maps provider refusal and timeout to typed skipped results', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true');
  Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch;
  const context = {
    jwtClaims: { is_anonymous: true },
    userClaims: { id: '00000000-0000-0000-0000-000000000001' },
    supabaseAdmin: adminFor(),
  };
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ status: 'incomplete' }));
    const refused = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }), context);
    if ((await refused.json() as { reason: string }).reason !== 'refused') throw new Error('provider refusal was not typed');
    globalThis.fetch = async () => new Response('{}', { status: 408 });
    const timedOut = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }), context);
    if ((await timedOut.json() as { reason: string }).reason !== 'timeout') throw new Error('provider timeout was not typed');
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete('TRAVEL_LIFE_AI_ENABLED');
    Deno.env.delete('OPENAI_API_KEY');
  }
});

Deno.test('settles only sanitized measurement fields after a reserved provider request', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true');
  Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch;
  const settled: Record<string, unknown>[] = [];
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 12, output_tokens: 4 }, output: [{ content: [{ type: 'output_text', text: JSON.stringify({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0', 'c_1'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'possible-grouping' }] }) }] }] }));
  try {
    const response = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }), { jwtClaims: { is_anonymous: true }, userClaims: { id: '00000000-0000-0000-0000-000000000001' }, supabaseAdmin: adminFor(true, settled) });
    if ((await response.json() as { status: string }).status !== 'proposal' || settled.length !== 1) throw new Error('reserved request did not settle');
    const measurement = settled[0];
    for (const forbidden of ['body', 'request', 'response', 'error', 'subject', 'header', 'token']) if (forbidden in measurement) throw new Error(`private ${forbidden} was persisted`);
    if (measurement.attempt_input_tokens !== 12 || measurement.attempt_output_tokens !== 4 || measurement.attempt_calculated_usd !== null || typeof measurement.attempt_elapsed_millis !== 'number') throw new Error('sanitized known measurement was incomplete');
  } finally { globalThis.fetch = originalFetch; Deno.env.delete('TRAVEL_LIFE_AI_ENABLED'); Deno.env.delete('OPENAI_API_KEY'); }
});

Deno.test('opens attempts with the exact frozen version contract', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true'); Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch; const opened: Record<string, unknown>[] = [];
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 'incomplete' }));
  try {
    await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }), { jwtClaims: { is_anonymous: true }, userClaims: { id: '00000000-0000-0000-0000-000000000001' }, supabaseAdmin: adminFor(true, [], opened) });
    if (opened.length !== 1 || opened[0].attempt_contract_version !== 'travel-life-ai-v1' || opened[0].attempt_rule_version !== 'reconstruction-v1' || opened[0].attempt_model_version !== 'gpt-5.4-mini-2026-03-17' || opened[0].attempt_prompt_version !== 'travel-life-ai-prompt-v1') throw new Error('attempt versions were not frozen');
  } finally { globalThis.fetch = originalFetch; Deno.env.delete('TRAVEL_LIFE_AI_ENABLED'); Deno.env.delete('OPENAI_API_KEY'); }
});

Deno.test('an already-aborted owner request aborts the provider signal before fetch', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true'); Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch; let providerSignalAborted = false; const abort = new AbortController(); abort.abort();
  globalThis.fetch = async (_input, init) => { providerSignalAborted = init?.signal?.aborted === true; throw new DOMException('cancelled', 'AbortError'); };
  try {
    const response = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request), signal: abort.signal }), { jwtClaims: { is_anonymous: true }, userClaims: { id: '00000000-0000-0000-0000-000000000001' }, supabaseAdmin: adminFor() });
    if (!providerSignalAborted || (await response.json() as { reason: string }).reason !== 'cancelled') throw new Error('already-aborted request reached an active provider controller');
  } finally { globalThis.fetch = originalFetch; Deno.env.delete('TRAVEL_LIFE_AI_ENABLED'); Deno.env.delete('OPENAI_API_KEY'); }
});

Deno.test('an owner abort racing a successful provider response cannot return a proposal', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true'); Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch; const ownerAbort = new AbortController(); const settled: Record<string, unknown>[] = [];
  globalThis.fetch = async () => { ownerAbort.abort(); return new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 12, output_tokens: 4 }, output: [{ content: [{ type: 'output_text', text: JSON.stringify({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0', 'c_1'], confidence: 'low', rationaleCode: 'ambiguous-grouping', labelCode: 'possible-grouping' }] }) }] }] })); };
  try {
    const incoming = new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) });
    Object.defineProperty(incoming, 'signal', { value: ownerAbort.signal });
    const response = await handleProxyRequest(incoming, { jwtClaims: { is_anonymous: true }, userClaims: { id: '00000000-0000-0000-0000-000000000001' }, supabaseAdmin: adminFor(true, settled) });
    if ((await response.json() as { reason: string }).reason !== 'cancelled' || settled[0].attempt_outcome !== 'cancelled') throw new Error('late owner abort allowed a proposal');
  } finally { globalThis.fetch = originalFetch; Deno.env.delete('TRAVEL_LIFE_AI_ENABLED'); Deno.env.delete('OPENAI_API_KEY'); }
});

Deno.test('fails closed after settlement error envelopes or throws, retrying once', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true'); Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 'incomplete' }));
  try {
    for (const settleResult of [() => ({ data: null, error: { message: 'offline' } }), () => { throw new Error('offline'); }]) {
      const settled: Record<string, unknown>[] = [];
      const response = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }), { jwtClaims: { is_anonymous: true }, userClaims: { id: '00000000-0000-0000-0000-000000000001' }, supabaseAdmin: adminFor(true, settled, [], settleResult) });
      if ((await response.json() as { reason: string }).reason !== 'unavailable' || settled.length !== 2) throw new Error('settlement failure did not retry and fail closed');
    }
  } finally { globalThis.fetch = originalFetch; Deno.env.delete('TRAVEL_LIFE_AI_ENABLED'); Deno.env.delete('OPENAI_API_KEY'); }
});

Deno.test('records nullable unknown measurements and a typed cancelled outcome without persisting provider details', async () => {
  Deno.env.set('TRAVEL_LIFE_AI_ENABLED', 'true');
  Deno.env.set('OPENAI_API_KEY', 'synthetic-test-key');
  const originalFetch = globalThis.fetch;
  const settled: Record<string, unknown>[] = [];
  globalThis.fetch = async () => { abort.abort(); return new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 12, output_tokens: 4 }, output: [] })); };
  const abort = new AbortController();
  try {
    const incoming = new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) });
    Object.defineProperty(incoming, 'signal', { value: abort.signal });
    const pending = handleProxyRequest(incoming, { jwtClaims: { is_anonymous: true }, userClaims: { id: '00000000-0000-0000-0000-000000000001' }, supabaseAdmin: adminFor(true, settled) });
    if ((await (await pending).json() as { reason: string }).reason !== 'cancelled') throw new Error('owner cancellation was not typed');
    if (settled.length !== 1 || settled[0].attempt_input_tokens !== null || settled[0].attempt_output_tokens !== null || settled[0].attempt_calculated_usd !== null || settled[0].attempt_outcome !== 'cancelled') throw new Error('unknown cancellation measurement was not null-safe');
  } finally { globalThis.fetch = originalFetch; Deno.env.delete('TRAVEL_LIFE_AI_ENABLED'); Deno.env.delete('OPENAI_API_KEY'); }
});
