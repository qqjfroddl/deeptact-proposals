const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set(['.git', '.vercel', 'api', 'node_modules']);

const KNOWN_PROPOSALS = {
  '/sk-forest/ai-planning-2026': {
    client: 'SK포레스트',
    clientTag: 'SK',
    title: 'AI활용 기획 A to Z',
    date: '2026.04.30',
    status: 'draft',
    category: 'client'
  },
  '/kpf/ax-sharing-2026': {
    client: 'KPF',
    clientTag: 'KPF',
    title: 'AX 공유 문화 워크숍',
    date: '2026.04.29',
    status: 'draft',
    category: 'client'
  },
  '/das/vibecoding-2026': {
    client: '주식회사 다스',
    clientTag: 'DAS',
    title: '전사 바이브코딩 역량 내재화 3단계',
    date: '2026.04.23',
    status: 'draft',
    category: 'client'
  },
  '/profile': {
    client: '박재현 소장',
    clientTag: 'JH',
    title: '강사 프로필',
    date: '2026.04.17',
    status: 'standard',
    category: 'profile'
  },
  '/standard/ai-5stage-roadmap': {
    client: '표준 제안서',
    clientTag: '표준',
    title: 'AI 활용 5단계 교육 시리즈',
    date: '2026.04.16',
    status: 'standard',
    category: 'standard'
  },
  '/skplanet/2026leader-vibe-coding': {
    client: 'SK플래닛',
    clientTag: 'SK',
    title: '2026 리더 바이브 코딩 교육',
    date: '2026.03.28',
    status: 'sent',
    category: 'client'
  },
  '/standard/new-employee-ai': {
    client: '신입사원',
    clientTag: 'NEW',
    title: '신입사원 AI 활용법',
    date: '2026.04.18',
    status: 'standard',
    category: 'standard'
  },
  '/standard/leader-ai': {
    client: '표준 제안서',
    clientTag: 'LDR',
    title: '리더를 위한 AI 활용법',
    date: '2026.04.18',
    status: 'standard',
    category: 'standard'
  }
};

function walk(dir, parts = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      found.push(...walk(path.join(dir, entry.name), [...parts, entry.name]));
      continue;
    }

    if (entry.name === 'index.html' && parts.length > 0) {
      found.push({
        filePath: path.join(dir, entry.name),
        proposalPath: `/${parts.join('/')}`
      });
    }
  }

  return found;
}

function textBetween(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanTitle(value) {
  return value
    .replace(/\s*\uAD50\uC721?\s*\uC81C\uC548\uC11C$/u, '')
    .replace(/\s*\uC81C\uC548\uC11C$/u, '')
    .trim();
}

function titleCaseSegment(segment) {
  return segment
    .split('-')
    .filter(Boolean)
    .map(part => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferFromTitle(rawTitle, proposalPath) {
  const decodedTitle = decodeEntities(rawTitle);
  const fallbackClient = titleCaseSegment(proposalPath.split('/').filter(Boolean)[0] || 'Proposal');
  let client = fallbackClient;
  let title = cleanTitle(decodedTitle || proposalPath.split('/').filter(Boolean).pop() || 'Proposal');

  if (decodedTitle.includes('\u00D7')) {
    const [, rest] = decodedTitle.split('\u00D7');
    const [clientPart, titlePart] = rest.split('|').map(part => part.trim());
    client = clientPart || client;
    title = cleanTitle(titlePart || title);
  } else if (decodedTitle.includes('|')) {
    const [left, right] = decodedTitle.split('|').map(part => part.trim());
    if (right) title = cleanTitle(right);
    if (!left.includes('\uB525\uD0DD\uD2B8')) client = left || client;
  }

  return { client, title };
}

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function inferDefaults(proposalPath, filePath) {
  const firstSegment = proposalPath.split('/').filter(Boolean)[0] || '';
  const stat = fs.statSync(filePath);

  if (proposalPath === '/profile') {
    return { status: 'standard', category: 'profile', clientTag: 'JH' };
  }

  if (firstSegment === 'standard') {
    return { status: 'standard', category: 'standard', clientTag: 'STD' };
  }

  return {
    status: 'draft',
    category: 'client',
    clientTag: titleCaseSegment(firstSegment).slice(0, 3).toUpperCase(),
    date: formatDate(stat.mtime)
  };
}

function buildProposal(item) {
  const content = fs.readFileSync(item.filePath, 'utf8');
  const rawTitle = textBetween(content, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const inferred = inferFromTitle(rawTitle, item.proposalPath);
  const defaults = inferDefaults(item.proposalPath, item.filePath);
  const known = KNOWN_PROPOSALS[item.proposalPath] || {};

  return {
    client: known.client || inferred.client,
    clientTag: known.clientTag || defaults.clientTag || inferred.client.slice(0, 2),
    title: known.title || inferred.title,
    path: item.proposalPath,
    date: known.date || defaults.date || formatDate(fs.statSync(item.filePath).mtime),
    status: known.status || defaults.status || 'draft',
    category: known.category || defaults.category || 'client'
  };
}

function sortProposals(a, b) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return a.path.localeCompare(b.path);
}

module.exports = function handler(req, res) {
  try {
    const proposals = walk(ROOT).map(buildProposal).sort(sortProposals);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.statusCode = 200;
    res.end(JSON.stringify({ proposals }));
  } catch (error) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to load proposals' }));
  }
};
