const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { buildInviteHtml } = require('./generate-invite-html');

const root = path.resolve(__dirname, '..');
const nginxConfig = fs.readFileSync(path.join(root, 'nginx', 'default.conf.http'), 'utf8');
const imagePath = path.join(root, 'public', 'comuva-convite-share.jpg');

const fixtureIndex = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><link rel="icon" href="/favicon.ico"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="theme-color" content="#2e7d32"/><meta name="description" content="Default description"/><link rel="canonical" href="https://comuva.com/"/><link rel="apple-touch-icon" href="/logo192.png"/><link rel="manifest" href="/manifest.json"/><meta property="og:url" content="https://comuva.com/"/><meta property="og:image" content="https://comuva.com/comuva-share.png"/><meta name="twitter:image" content="https://comuva.com/comuva-share.png"/><title>COMUVA</title><script defer="defer" src="/static/js/main.hash.js"></script><link href="/static/css/main.hash.css" rel="stylesheet"></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>`;

const inviteHtml = buildInviteHtml(fixtureIndex);

assert(inviteHtml.includes('property="og:title" content="Convite para participar de uma comunidade no COMUVA"'));
assert(inviteHtml.includes('property="og:image" content="https://comuva.com/comuva-convite-share.jpg"'));
assert(inviteHtml.includes('name="twitter:image" content="https://comuva.com/comuva-convite-share.jpg"'));
assert(inviteHtml.includes('<script defer="defer" src="/static/js/main.hash.js"></script>'));
assert(inviteHtml.includes('<link href="/static/css/main.hash.css" rel="stylesheet">'));
assert(inviteHtml.includes('<link rel="manifest" href="/manifest.json"/>'));
assert(inviteHtml.includes('<div id="root"></div>'));
assert(!inviteHtml.includes('property="og:url"'));
assert(!inviteHtml.includes('rel="canonical"'));
assert(!inviteHtml.includes('$request_uri'));
assert(!inviteHtml.includes('?utm_source='));

assert(nginxConfig.includes('location ~ ^/convite/[^/]+$'));
assert(nginxConfig.includes('try_files /convite.html /index.html'));
assert(!nginxConfig.includes('$http_user_agent'));
assert(!nginxConfig.includes('Vary "User-Agent"'));
assert(!nginxConfig.includes('$request_uri'));
assert(nginxConfig.includes('location /api/'));
assert(nginxConfig.includes('location / {\n        try_files $uri /index.html;\n    }'));

const imageBytes = fs.readFileSync(imagePath);
assert.strictEqual(imageBytes[0], 0xff);
assert.strictEqual(imageBytes[1], 0xd8);
assert(imageBytes.length < 500 * 1024, `Expected OG image below 500 KB, got ${imageBytes.length} bytes`);

console.log('Invite preview checks passed.');
