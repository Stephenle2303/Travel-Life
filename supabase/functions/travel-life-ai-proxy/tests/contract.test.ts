import { handleProxyRequest, outputText, parseProposal, parseRequest } from '../index.ts';

const request = {
  contractVersion: 'travel-life-ai-v1', consentRevision: 1, ruleVersion: 'reconstruction-v1', evidenceRevision: 2, correctionRevision: 3,
  alternatives: [{ id: 'a_0', kind: 'journey-group', candidateIds: ['c_0', 'c_1'], relativeDayOffsets: [0, 2], evidenceCategories: ['geotagged', 'gps-less'] }],
};

Deno.test('rejects private or arbitrary request fields before a provider call', () => {
  if (parseRequest({ ...request, filename: 'private.jpg' }) !== null) throw new Error('extra private field was accepted');
  if (parseRequest({ ...request, alternatives: [{ ...request.alternatives[0], candidateIds: ['c_0'], relativeDayOffsets: [0], evidenceCategories: ['geotagged'], latitude: 13.7 }] }) !== null) throw new Error('nested private field was accepted');
});

Deno.test('proposal references remain bounded to supplied opaque candidates', () => {
  const parsed = parseRequest(request);
  if (!parsed) throw new Error('synthetic fixture was rejected');
  if (parseProposal({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_not_supplied'], confidence: 'low', rationaleCode: 'ambiguous-grouping' }] }, parsed) !== null) throw new Error('unknown candidate was accepted');
  if (parseProposal({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0'], confidence: 'low', rationaleCode: 'ambiguous-grouping' }] }, parsed) === null) throw new Error('valid bounded proposal was rejected');
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
      output: [{ content: [{ type: 'output_text', text: JSON.stringify({ proposals: [{ alternativeId: 'a_0', selectedCandidateIds: ['c_0'], confidence: 'low', rationaleCode: 'ambiguous-grouping' }] }) }] }],
    }));
  };
  try {
    const response = await handleProxyRequest(new Request('https://proxy.example', { method: 'POST', body: JSON.stringify(request) }), {
      jwtClaims: { is_anonymous: true },
      userClaims: { id: '00000000-0000-0000-0000-000000000001' },
      supabaseAdmin: { rpc: () => ({ single: async () => ({ data: { reserved: true, reason: null }, error: null }) }) },
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
      supabaseAdmin: { rpc: () => ({ single: async () => ({ data: { reserved: false, reason: 'daily-budget-limit' }, error: null }) }) },
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
      supabaseAdmin: { rpc: () => ({ single: async () => ({ data: { reserved: true, reason: null }, error: null }) }) },
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
    supabaseAdmin: { rpc: () => ({ single: async () => ({ data: { reserved: true, reason: null }, error: null }) }) },
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
