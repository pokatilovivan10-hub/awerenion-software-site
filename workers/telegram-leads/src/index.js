const MAX_BODY_BYTES = 40 * 1024;
const MAX_MESSAGE_LENGTH = 3_000;

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function corsHeaders(origin, allowedOrigin) {
  if (origin !== allowedOrigin) return null;
  return {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  };
}

function value(params, name, maxLength) {
  const raw = params.get(name);
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLength);
}

function telegramText({ name, contact, message, origin }) {
  return [
    'Новая заявка с сайта Z7 Technologies',
    '',
    `Имя: ${name}`,
    `Контакт: ${contact}`,
    `Задача: ${message}`,
    '',
    `Источник: ${origin}`,
  ].join('\n');
}

async function readBody(request) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RangeError('payload_too_large');
  }

  const reader = request.body?.getReader();
  if (!reader) return '';

  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError('payload_too_large');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return cors ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status: 403 });
    }

    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    if (!cors) return json({ ok: false, error: 'origin_not_allowed' }, 403);
    if (!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      return json({ ok: false, error: 'unsupported_content_type' }, 415, cors);
    }

    let body;
    try {
      body = await readBody(request);
    } catch (error) {
      if (error instanceof RangeError) return json({ ok: false, error: 'payload_too_large' }, 413, cors);
      return json({ ok: false, error: 'invalid_request' }, 400, cors);
    }

    const params = new URLSearchParams(body);
    if (value(params, 'bot-field', 1)) return json({ ok: true }, 200, cors);
    if (value(params, 'privacy_consent', 10) !== 'yes') {
      return json({ ok: false, error: 'consent_required' }, 400, cors);
    }

    const rawMessage = params.get('message') || '';
    const name = value(params, 'name', 100);
    const contact = value(params, 'contact', 130);
    const message = value(params, 'message', MAX_MESSAGE_LENGTH);
    if (!name || !contact || !message || rawMessage.trim().length > MAX_MESSAGE_LENGTH) {
      return json({ ok: false, error: 'invalid_form' }, 400, cors);
    }
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return json({ ok: false, error: 'service_not_configured' }, 503, cors);
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: telegramText({ name, contact, message, origin }),
        disable_web_page_preview: true,
      }),
    });
    const telegramResult = await telegramResponse.json().catch(() => null);
    if (!telegramResponse.ok || !telegramResult?.ok) {
      return json({ ok: false, error: 'delivery_failed' }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};
