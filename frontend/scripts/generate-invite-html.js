const fs = require('fs');
const path = require('path');

const INVITE_META = `
    <meta name="description" content="Entre em uma comunidade pela COMUVA. Comunidade viva, ativa e em movimento." />
    <meta property="og:site_name" content="COMUVA" />
    <meta property="og:title" content="Convite para participar de uma comunidade no COMUVA" />
    <meta property="og:description" content="Entre em uma comunidade pela COMUVA. Comunidade viva, ativa e em movimento." />
    <meta property="og:image" content="https://comuva.com/comuva-convite-share.jpg" />
    <meta property="og:image:secure_url" content="https://comuva.com/comuva-convite-share.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="COMUVA - Convite para comunidade" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="pt_BR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Convite para participar de uma comunidade no COMUVA" />
    <meta name="twitter:description" content="Entre em uma comunidade pela COMUVA. Comunidade viva, ativa e em movimento." />
    <meta name="twitter:image" content="https://comuva.com/comuva-convite-share.jpg" />
    <meta name="twitter:image:alt" content="COMUVA - Convite para comunidade" />
    <title>Convite para participar de uma comunidade no COMUVA</title>`;

function withoutShareMeta(head) {
  return head
    .replace(/\s*<meta\s+name=["']description["'][^>]*>\s*/gi, '\n')
    .replace(/\s*<link\s+rel=["']canonical["'][^>]*>\s*/gi, '\n')
    .replace(/\s*<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, '\n')
    .replace(/\s*<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '\n')
    .replace(/\s*<title>[\s\S]*?<\/title>\s*/gi, '\n');
}

function buildInviteHtml(indexHtml) {
  const headMatch = indexHtml.match(/<head>([\s\S]*?)<\/head>/i);
  if (!headMatch) {
    throw new Error('build/index.html does not contain a <head> section.');
  }

  const cleanedHead = withoutShareMeta(headMatch[1]);
  const inviteHead = `${cleanedHead.trimEnd()}\n${INVITE_META}\n  `;

  return indexHtml.replace(headMatch[0], `<head>${inviteHead}</head>`);
}

function main() {
  const buildDir = path.resolve(__dirname, '..', 'build');
  const indexPath = path.join(buildDir, 'index.html');
  const invitePath = path.join(buildDir, 'convite.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  fs.writeFileSync(invitePath, buildInviteHtml(indexHtml));
  console.log(`Generated ${path.relative(process.cwd(), invitePath)} from ${path.relative(process.cwd(), indexPath)}`);
}

if (require.main === module) {
  main();
}

module.exports = { buildInviteHtml };
