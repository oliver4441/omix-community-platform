# Marketplace Webhook Example (Node.js)

This example shows how to verify GitHub Marketplace webhook HMAC and handle purchase/subscription events.

```js
// marketplace-webhook.js
const crypto = require('crypto');
const express = require('express');
const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const WEBHOOK_SECRET = process.env.MARKETPLACE_WEBHOOK_SECRET || 'replace_with_secret';

function verifySignature(req) {
  const sig = req.headers['x-hub-signature-256'] || '';
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(req.rawBody);
  const expected = `sha256=${hmac.digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

app.post('/marketplace-webhook', (req, res) => {
  try {
    if (!verifySignature(req)) return res.status(401).send('invalid signature');
    const event = req.headers['x-github-event'];
    const payload = req.body;

    // Handle events
    switch (event) {
      case 'marketplace_purchase':
        // grant access, create subscription record
        break;
      case 'marketplace_change':
        // upgrade/downgrade
        break;
      case 'marketplace_cancelled':
        // revoke access
        break;
      default:
        break;
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    res.status(500).send('error');
  }
});

module.exports = app;
```

Notes:
- Deploy behind HTTPS
- Set MARKETPLACE_WEBHOOK_SECRET in environment
- Validate rate limits and idempotency for events
