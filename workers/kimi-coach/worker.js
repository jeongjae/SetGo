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

function responseSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['action', 'confidence', 'summaryKo', 'adjustments', 'warnings'],
    properties: {
      action: {
        type: 'string',
        enum: ['keep_plan', 'reduce_volume', 'increase_recovery', 'deload', 'rest'],
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
      },
      summaryKo: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
      },
      summaryEn: {
        type: 'string',
        maxLength: 500,
      },
      adjustments: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['target', 'change', 'reasonCode'],
          properties: {
            target: { type: 'string', maxLength: 80 },
            change: {
              type: 'string',
              enum: ['keep', 'reduce_sets', 'hold_weight', 'raise_rir', 'deload', 'rest'],
            },
            reasonCode: { type: 'string', maxLength: 80 },
          },
        },
      },
      warnings: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'messageKo'],
          properties: {
            type: {
              type: 'string',
              enum: ['recovery', 'volume', 'hard_sets', 'consistency', 'other'],
            },
            messageKo: { type: 'string', maxLength: 240 },
            messageEn: { type: 'string', maxLength: 240 },
          },
        },
      },
    },
  };
}

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
        context,
      }),
    },
  ];
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

  const kimiResponse = await fetch(KIMI_API_URL, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${env.KIMI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.KIMI_MODEL || 'kimi-k2.6',
      messages: buildMessages(context),
      temperature: 1,
      max_tokens: 900,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'setgo_ai_coach_response',
          strict: true,
          schema: responseSchema(),
        },
      },
    }),
  });

  const kimiText = await kimiResponse.text();
  if (!kimiResponse.ok) {
    return jsonResponse({
      error: 'Kimi API request failed.',
      status: kimiResponse.status,
      detail: kimiText.slice(0, 1000),
    }, 502, origin, env);
  }

  let kimiJson;
  try {
    kimiJson = JSON.parse(kimiText);
  } catch {
    return jsonResponse({ error: 'Kimi API returned non-JSON response.' }, 502, origin, env);
  }

  const content = kimiJson?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return jsonResponse({ error: 'Kimi API response did not include message content.' }, 502, origin, env);
  }

  try {
    return jsonResponse(JSON.parse(content), 200, origin, env);
  } catch {
    return jsonResponse({ error: 'Kimi API returned invalid structured JSON.', raw: content.slice(0, 1000) }, 502, origin, env);
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
