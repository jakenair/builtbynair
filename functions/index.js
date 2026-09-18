const functions = require('@google-cloud/functions-framework');

const TO = (process.env.TO_ADDRS || '').split(',').map(s => s.trim()).filter(Boolean);
const FROM = process.env.FROM_ADDR || 'Built by Nair <inquiries@mail.teeboxmarket.com>';
const ALLOWED = new Set(['https://builtbynair.com', 'https://www.builtbynair.com']);

// Per-instance throttle. Not a hard guarantee across instances, but enough to
// stop a single script hammering the form; max-instances caps the rest.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  if (hits.size > 500) hits.clear();
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 5;
}

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

functions.http('inquiry', async (req, res) => {
  const origin = req.get('origin');
  if (origin && ALLOWED.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });
  if (origin && !ALLOWED.has(origin)) return res.status(403).json({ ok: false, error: 'origin' });

  const b = req.body || {};
  if (clip(b.website, 100)) return res.json({ ok: true }); // honeypot: bots fill it, humans can't see it

  const name = clip(b.name, 120);
  const email = clip(b.email, 200);
  const company = clip(b.company, 160);
  const timeline = clip(b.timeline, 80);
  const project = clip(b.project, 5000);

  if (!name || !project || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  const ip = (req.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate' });

  const key = process.env.RESEND_API_KEY;
  if (!key || !TO.length) {
    console.error('misconfigured: key=' + !!key + ' to=' + TO.length);
    return res.status(500).json({ ok: false, error: 'config' });
  }

  const subject = 'Free consultation request — ' + name + (company ? ' (' + company + ')' : '');
  const text = [
    'Name: ' + name,
    'Email: ' + email,
    'Company: ' + (company || '—'),
    'Timeline: ' + (timeline || '—'),
    '',
    'What they are building:',
    project,
    '',
    '— Reply to this email to answer them directly.'
  ].join('\n');

  const html = '<div style="font:15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#14181D">'
    + '<p style="margin:0 0 18px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#6B7684">'
    + 'Free consultation request</p>'
    + '<p style="margin:0 0 6px"><strong>' + esc(name) + '</strong>'
    + (company ? ' &middot; ' + esc(company) : '') + '</p>'
    + '<p style="margin:0 0 4px"><a href="mailto:' + esc(email) + '">' + esc(email) + '</a></p>'
    + '<p style="margin:0 0 20px;color:#6B7684">Timeline: ' + esc(timeline || '—') + '</p>'
    + '<p style="margin:0 0 6px;font-weight:600">What they are building</p>'
    + '<p style="margin:0 0 24px;white-space:pre-wrap">' + esc(project) + '</p>'
    + '<p style="margin:0;color:#6B7684;font-size:13px">Reply to this email to answer them directly.</p>'
    + '</div>';

  // One message per recipient. A single bad address must not take down the
  // others, and this gives us per-recipient delivery status in the Resend log.
  async function sendOne(addr) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [addr], reply_to: email, subject, text, html })
      });
      if (!r.ok) {
        console.error('resend ' + r.status + ' to=' + addr + ' ' + (await r.text()));
        return false;
      }
      const j = await r.json();
      console.log('sent id=' + j.id + ' to=' + addr + ' ip=' + ip);
      return true;
    } catch (e) {
      console.error('send threw to=' + addr + ': ' + (e && e.message));
      return false;
    }
  }

  const results = await Promise.all(TO.map(sendOne));
  const delivered = results.filter(Boolean).length;
  if (!delivered) return res.status(502).json({ ok: false, error: 'send' });
  if (delivered < TO.length) console.error('PARTIAL: ' + delivered + '/' + TO.length + ' accepted');
  return res.json({ ok: true });
});
