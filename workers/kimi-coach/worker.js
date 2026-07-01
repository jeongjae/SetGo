const KIMI_API_URL = 'https://api.moonshot.ai/v1/chat/completions';

function corsHeaders(origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const allowOrigin = allowedOrigin === '*' ? '*' : origin === allowedOrigin ? origin : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResponse(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin, env),
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

const RESPONSE_CONTRACT = {
  action: 'keep_plan | reduce_volume | increase_recovery | deload | rest',
  confidence: 'low | medium | high',
  summaryKo: 'Korean coaching summary, max 3 short sentences',
  summaryEn: 'Optional English summary',
  adjustments: [
    {
      target: 'exercise id, exercise name, or today',
      change: 'keep | reduce_sets | hold_weight | raise_rir | deload | rest',
      reasonCode: 'short snake_case reason',
    },
  ],
  warnings: [
    {
      type: 'recovery | volume | hard_sets | consistency | other',
      messageKo: 'Korean warning sentence',
      messageEn: 'Optional English warning sentence',
    },
  ],
};

function buildMessages(context) {
  return [
    {
      role: 'system',
      content: [
        'You are SetGo AI Coach, a conservative strength-training assistant.',
        'The app already computed the workout recommendation. Do not replace it.',
        'Your job is to explain the plan, flag recovery or volume risks, and suggest small optional adjustments.',
        'Never invent workout history. Use only the provided JSON.',
        'Do not provide medical diagnosis. Keep advice practical and low-risk.',
        'Always write summaryKo in Korean.',
        'Return only valid JSON. Do not wrap it in markdown.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'Create a concise coaching note for today based on this SetGo context.',
        constraints: [
          'Prefer keep_plan unless clear fatigue or deload evidence exists.',
          'If recovery is low, prefer raise_rir or reduce_sets before rest.',
          'Do not increase weight, sets, or intensity beyond the SetGo local recommendation.',
          'Return only the structured JSON object.',
        ],
        requiredJsonContract: RESPONSE_CONTRACT,
        context,
      }),
    },
  ];
}

function extractMessageContent(kimiJson) {
  const content = kimiJson?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

function parseJsonContent(content) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('empty content');
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(unfenced);
}

async function callKimi(env, context, useJsonMode) {
  const body = {
    model: env.KIMI_MODEL || 'kimi-k2.6',
    messages: buildMessages(context),
    max_tokens: 900,
    thinking: { type: 'disabled' },
  };

  if (useJsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const kimiResponse = await fetch(KIMI_API_URL, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${env.KIMI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const kimiText = await kimiResponse.text();
  if (!kimiResponse.ok) {
    return {
      ok: false,
      status: kimiResponse.status,
      error: kimiText.slice(0, 1000),
    };
  }

  try {
    return {
      ok: true,
      json: JSON.parse(kimiText),
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: 'Kimi API returned non-JSON response.',
    };
  }
}

async function handleCoach(request, env) {
  const origin = request.headers.get('Origin') || '*';
  if (!env.KIMI_API_KEY) {
    return jsonResponse({ error: 'KIMI_API_KEY is not configured on the Worker.' }, 500, origin, env);
  }

  const rawBody = await request.text();
  if (rawBody.length > 24000) {
    return jsonResponse({ error: 'Request is too large for the AI coach.' }, 413, origin, env);
  }

  let context;
  try {
    context = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400, origin, env);
  }

  const firstAttempt = await callKimi(env, context, true);
  let kimiJson = firstAttempt.json;
  if (!firstAttempt.ok) {
    const retryAttempt = await callKimi(env, context, false);
    if (!retryAttempt.ok) {
      return jsonResponse({
        error: 'Kimi API request failed.',
        status: retryAttempt.status,
        detail: retryAttempt.error,
        firstAttempt: {
          status: firstAttempt.status,
          detail: firstAttempt.error,
        },
      }, 502, origin, env);
    }
    kimiJson = retryAttempt.json;
  }

  try {
    const content = extractMessageContent(kimiJson);
    return jsonResponse(parseJsonContent(content), 200, origin, env);
  } catch {
    const fallbackAttempt = await callKimi(env, context, false);
    if (!fallbackAttempt.ok) {
      return jsonResponse({
        error: 'Kimi API fallback request failed.',
        status: fallbackAttempt.status,
        detail: fallbackAttempt.error,
      }, 502, origin, env);
    }

    const fallbackContent = extractMessageContent(fallbackAttempt.json);
    try {
      return jsonResponse(parseJsonContent(fallbackContent), 200, origin, env);
    } catch {
      return jsonResponse({
        error: 'Kimi API returned invalid structured JSON.',
        raw: fallbackContent.slice(0, 1000),
      }, 502, origin, env);
    }
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/coach') {
      return jsonResponse({ error: 'Not found. Use POST /coach.' }, 404, origin, env);
    }

    try {
      return await handleCoach(request, env);
    } catch (error) {
      return jsonResponse({
        error: error instanceof Error ? error.message : 'Unexpected Worker error.',
      }, 500, origin, env);
    }
  },
};
