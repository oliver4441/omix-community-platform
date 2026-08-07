const crypto = require('crypto');

exports.handler = async function (event, context) {
  const secret = process.env.MARKETPLACE_WEBHOOK_SECRET || 'replace_with_secret';
  const sig = event.headers['x-hub-signature-256'] || '';
  const body = event.body || '';

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const expected = `sha256=${hmac.digest('hex')}`;

  if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { statusCode: 401, body: 'invalid signature' };
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch (e) {
    payload = body;
  }

  const eventType = event.headers['x-github-event'] || 'unknown';

  // Minimal handling: log event and return
  console.log('Marketplace event', eventType, payload.action || '');

  // TODO: grant/revoke access based on payload

  return { statusCode: 200, body: 'ok' };
};