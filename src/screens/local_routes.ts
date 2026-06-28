export type LocalScreenView = 'split' | 'host' | 'player' | 'debug';

export interface LocalRouteState {
  view: LocalScreenView;
  path: string;
  playerId?: string;
  invalidPath?: string;
  invalidPlayerId?: string;
}

export function parseLocalRoute(pathname: string): LocalRouteState {
  const path = normalizeLocalPath(pathname);
  if (path === '/') return { view: 'split', path };
  if (path === '/host') return { view: 'host', path };
  if (path === '/debug') return { view: 'debug', path };

  const playerMatch = path.match(/^\/player\/([^/]+)$/);
  if (playerMatch) {
    const playerId = playerMatch[1];
    if (/^p[1-6]$/.test(playerId)) {
      return { view: 'player', path, playerId };
    }
    return { view: 'player', path, invalidPlayerId: playerId };
  }

  return { view: 'split', path, invalidPath: path };
}

export function localPathForView(view: LocalScreenView, playerId = 'p1'): string {
  if (view === 'host') return '/host';
  if (view === 'player') return `/player/${playerId}`;
  if (view === 'debug') return '/debug';
  return '/';
}

function normalizeLocalPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path.startsWith('/') ? path : `/${path}`;
}
