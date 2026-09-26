const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { buildInviteHtml } = require('./generate-invite-html');

const root = path.resolve(__dirname, '..');
const nginxConfig = fs.readFileSync(path.join(root, 'nginx', 'default.conf.http'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const homeImagePath = path.join(root, 'public', 'comuva-share.jpg');
const inviteImagePath = path.join(root, 'public', 'comuva-convite-share.jpg');

const HOME_TITLE = 'COMUVA — Comunidade Viva, Ativa e em Movimento';
const HOME_DESCRIPTION = 'Conectando pessoas para fortalecer suas comunidades. Entre na COMUVA e faça parte de uma comunidade viva, ativa e em movimento.';
const HOME_IMAGE = 'https://comuva.com/comuva-share.jpg';
const INVITE_TITLE = 'Convite para participar de uma comunidade no COMUVA';
const INVITE_IMAGE = 'https://comuva.com/comuva-convite-share.jpg';

const fixtureIndex = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><link rel="icon" href="/favicon.ico"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="theme-color" content="#2e7d32"/><meta name="description" content="${HOME_DESCRIPTION}"/><link rel="canonical" href="https://comuva.com/"/><link rel="apple-touch-icon" href="/logo192.png"/><link rel="manifest" href="/manifest.json"/><meta property="og:title" content="${HOME_TITLE}"/><meta property="og:description" content="${HOME_DESCRIPTION}"/><meta property="og:url" content="https://comuva.com/"/><meta property="og:image" content="${HOME_IMAGE}"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:image" content="${HOME_IMAGE}"/><title>${HOME_TITLE}</title><script defer="defer" src="/static/js/main.hash.js"></script><link href="/static/css/main.hash.css" rel="stylesheet"></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>`;

const inviteHtml = buildInviteHtml(fixtureIndex);

assert(homeHtml.includes(`<title>${HOME_TITLE}</title>`));
assert(homeHtml.includes(`name="description"\n      content="${HOME_DESCRIPTION}"`));
assert(homeHtml.includes(`property="og:title" content="${HOME_TITLE}"`));
assert(homeHtml.includes(`property="og:description" content="${HOME_DESCRIPTION}"`));
assert(homeHtml.includes('property="og:url" content="https://comuva.com/"'));
assert(homeHtml.includes(`property="og:image" content="${HOME_IMAGE}"`));
assert(homeHtml.includes(`property="og:image:secure_url" content="${HOME_IMAGE}"`));
assert(homeHtml.includes('name="twitter:card" content="summary_large_image"'));
assert(homeHtml.includes(`name="twitter:image" content="${HOME_IMAGE}"`));
assert(homeHtml.includes('<div id="root"></div>'));
assert(!homeHtml.includes(INVITE_TITLE));
assert(!homeHtml.includes('Convite para comunidade'));
assert(!homeHtml.includes('comuva-convite-share.jpg'));

assert(inviteHtml.includes(`property="og:title" content="${INVITE_TITLE}"`));
assert(inviteHtml.includes(`property="og:image" content="${INVITE_IMAGE}"`));
assert(inviteHtml.includes(`name="twitter:image" content="${INVITE_IMAGE}"`));
assert(inviteHtml.includes('<script defer="defer" src="/static/js/main.hash.js"></script>'));
assert(inviteHtml.includes('<link href="/static/css/main.hash.css" rel="stylesheet">'));
assert(inviteHtml.includes('<link rel="manifest" href="/manifest.json"/>'));
assert(inviteHtml.includes('<div id="root"></div>'));
assert(!inviteHtml.includes(HOME_TITLE));
assert(!inviteHtml.includes(`property="og:image" content="${HOME_IMAGE}"`));
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

const homeImageBytes = fs.readFileSync(homeImagePath);
assert.strictEqual(homeImageBytes[0], 0xff);
assert.strictEqual(homeImageBytes[1], 0xd8);
assert(homeImageBytes.length < 300 * 1024, `Expected home OG image below 300 KB, got ${homeImageBytes.length} bytes`);

const inviteImageBytes = fs.readFileSync(inviteImagePath);
assert.strictEqual(inviteImageBytes[0], 0xff);
assert.strictEqual(inviteImageBytes[1], 0xd8);
assert(inviteImageBytes.length < 500 * 1024, `Expected invite OG image below 500 KB, got ${inviteImageBytes.length} bytes`);

console.log('Home and invite preview checks passed.');
