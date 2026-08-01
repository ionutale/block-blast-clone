const ROUTES = [
  { pattern: /^#\/$/, name: 'menu' },
  { pattern: /^#\/levels$/, name: 'levels' },
  { pattern: /^#\/settings$/, name: 'settings' },
  { pattern: /^#\/leaderboard$/, name: 'leaderboard' },
  { pattern: /^#\/play$/, name: 'play' },
  { pattern: /^#\/level\/(\d+)$/, name: 'level' },
];

export function parseHash(hash) {
  const clean = hash || '#/';
  for (const route of ROUTES) {
    const m = clean.match(route.pattern);
    if (m) return { name: route.name, param: m[1] ? Number(m[1]) : null };
  }
  return { name: 'menu', param: null };
}

export function initRouter(handlers) {
  function navigate() {
    const route = parseHash(window.location.hash);
    const handler = handlers[route.name];
    if (handler) handler(route);
  }
  window.addEventListener('hashchange', navigate);
  navigate();
}
