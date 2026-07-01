export type LocalScreenView = 'alpha' | 'split' | 'board' | 'player' | 'debug';

export interface LocalRouteState {
  view: LocalScreenView;
  path: string;
  playerId?: string;
  invalidPath?: string;
  invalidPlayerId?: string;
}

export function parseLocalRoute(pathname: string): LocalRouteState {
  const path = normalizeLocalPath(pathname);
  if (path === '/') return { view: 'alpha', path };
  if (path === '/dev') return { view: 'split', path };
  if (path === '/board' || path === '/host') return { view: 'board', path };
  if (path === '/debug') return { view: 'debug', path };

  const playerMatch = path.match(/^\/player\/([^/]+)$/);
  if (playerMatch) {
    const playerId = playerMatch[1];
    if (/^p[1-6]$/.test(playerId)) {
      return { view: 'player', path, playerId };
    }
    return { view: 'player', path, invalidPlayerId: playerId };
  }

  return { view: 'alpha', path, invalidPath: path };
}

export function localPathForView(view: LocalScreenView, playerId = 'p1'): string {
  if (view === 'alpha') return '/';
  if (view === 'board') return '/board';
  if (view === 'player') return `/player/${playerId}`;
  if (view === 'debug') return '/debug';
  return '/dev';
}

export function shouldOpenRouteButtonInNewTab(activeView: LocalScreenView, targetIsActive: boolean): boolean {
  if (targetIsActive) return false;
  return activeView === 'board' || activeView === 'player';
}

export function stripRouteBase(pathname: string, baseUrl: string): string {
  const basePath = normalizeRouteBase(baseUrl);
  const path = normalizeLocalPath(pathname);
  if (!basePath) return path;
  if (path === basePath) return '/';
  if (path.startsWith(`${basePath}/`)) {
    return path.slice(basePath.length) || '/';
  }
  return path;
}

export function withRouteBase(pathname: string, baseUrl: string): string {
  const basePath = normalizeRouteBase(baseUrl);
  const path = normalizeLocalPath(pathname);
  if (!basePath) return path;
  return path === '/' ? `${basePath}/` : `${basePath}${path}`;
}

function normalizeRouteBase(baseUrl: string): string {
  if (!baseUrl || baseUrl === '/' || baseUrl === './') return '';
  const path = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return path.replace(/\/+$/, '');
}

function normalizeLocalPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path.startsWith('/') ? path : `/${path}`;
}
