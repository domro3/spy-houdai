export const PHONE_SYNC_MODE = 'phone';

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_LENGTH = 6;

export function createPhoneSyncRoomCode(): string {
  const values = new Uint8Array(ROOM_LENGTH);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * ROOM_CHARS.length);
    }
  }
  return Array.from(values, (value) => ROOM_CHARS[value % ROOM_CHARS.length]).join('');
}

export function normalizePhoneSyncRoom(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < 4) return undefined;
  return normalized.slice(0, 12);
}

export function phoneSyncRoomFromSearch(search: string): string | undefined {
  return normalizePhoneSyncRoom(new URLSearchParams(search).get('room'));
}

export function wantsPhoneSync(search: string): boolean {
  const params = new URLSearchParams(search);
  if (params.get('sync') === 'local' || params.get('peer') === '0') return false;
  return params.get('sync') === PHONE_SYNC_MODE
    || params.get('peer') === '1'
    || Boolean(phoneSyncRoomFromSearch(search));
}

export function buildPhoneSyncSearch(room: string): string {
  const normalized = normalizePhoneSyncRoom(room) ?? createPhoneSyncRoomCode();
  const params = new URLSearchParams();
  params.set('sync', PHONE_SYNC_MODE);
  params.set('room', normalized);
  return `?${params.toString()}`;
}

export function isPlayRoute(path: string): boolean {
  return path === '/board' || path === '/host' || path.startsWith('/player/');
}

export function shouldAutoCreatePhoneSyncRoom(location: Location, targetPath: string): boolean {
  if (targetPath !== '/board' && targetPath !== '/host') return false;
  if (location.protocol !== 'https:') return false;
  if (isLocalHostname(location.hostname)) return false;
  const params = new URLSearchParams(location.search);
  if (params.get('relay') === '1' || params.get('sync') === 'local' || params.get('peer') === '0') return false;
  return true;
}

export function ensurePhoneSyncRoomInUrl(targetPath: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!shouldAutoCreatePhoneSyncRoom(window.location, targetPath) && !wantsPhoneSync(window.location.search)) {
    return undefined;
  }
  if (!isPlayRoute(targetPath)) return undefined;

  const existingRoom = phoneSyncRoomFromSearch(window.location.search);
  const room = existingRoom ?? createPhoneSyncRoomCode();
  const params = new URLSearchParams(window.location.search);
  params.set('sync', PHONE_SYNC_MODE);
  params.set('room', room);
  const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(null, '', nextUrl);
  }
  return room;
}

export function playRouteSearchFor(path: string, currentSearch: string, location: Location): string {
  if (!isPlayRoute(path)) return '';

  const currentRoom = phoneSyncRoomFromSearch(currentSearch);
  if (currentRoom) return buildPhoneSyncSearch(currentRoom);
  if (shouldAutoCreatePhoneSyncRoom(location, path)) {
    return buildPhoneSyncSearch(createPhoneSyncRoomCode());
  }
  if (wantsPhoneSync(currentSearch) && (path === '/board' || path === '/host')) {
    return buildPhoneSyncSearch(createPhoneSyncRoomCode());
  }

  const params = new URLSearchParams(currentSearch);
  const relay = params.get('relay');
  if (relay === '1' || relay === '0') return `?relay=${relay}`;
  return '';
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname === '::1';
}
