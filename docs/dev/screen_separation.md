# M4 Screen Separation Prototype

Status: local prototype. This is not online play, LAN play, or smartphone support.

## Current Architecture

M4 separates the local UI into three screen responsibilities while keeping `GameEngine` as the single source of truth.

- `src/main.tsx`: local app controller, setup controls, phase progression, CPU fill, local route/view selection.
- `src/screens/HostScreen.tsx`: public host/central display.
- `src/screens/PlayerScreen.tsx`: selected local player display and input surface.
- `src/screens/DebugPanel.tsx`: developer-only debug log surface.
- `src/screens/local_routes.ts`: lightweight local path parsing for `/`, `/host`, `/player/:id`, and `/debug`.
- `src/screens/screen_view_models.ts`: public/private screen projections used for privacy guardrails.

## HostScreen

HostScreen is the public table display.

It may show:

- boss HP and base HP
- round and phase
- boss action and warning
- battle event feedback
- public logs
- public vote totals
- public player input status
- final result and revealed spy after the game ends

During active play, HostScreen must not show:

- spy identity
- spy-only action names
- private player logs
- debug logs
- selected player's hidden role

## PlayerScreen

PlayerScreen is a local player-view prototype.

It may show only the selected player's:

- player id and name
- own role
- available actions
- submitted action state
- vote controls
- private logs and personal action feedback

The `View as Player` selector is only for local development. It is not an authentication or device ownership system.

## DebugPanel

DebugPanel is separated from host and player public surfaces.

The `/debug` route shows DebugPanel without HostScreen or PlayerScreen. The default `/` development shell may also show it for quick local inspection.

## Local Routes

Current routes are local-only:

- `/`: development shell with HostScreen and one PlayerScreen
- `/host`: HostScreen only
- `/player/p1` through `/player/p6`: PlayerScreen for that local player id
- `/debug`: DebugPanel only

Invalid paths fall back to the development shell. Invalid player ids show a friendly notice and fall back to an available player.

## Known Limitations

- Each browser tab currently owns its own in-memory `GameEngine` instance.
- Opening `/host` and `/player/p1` in separate tabs does not synchronize game state yet.
- There are no rooms, WebSockets, LAN discovery, QR codes, authentication, or smartphone-specific controls.
- The route structure is a prototype for future separation, not a networking layer.

## Future Path

Future local network or online work should keep this boundary:

- GameCore/GameEngine remains authoritative.
- HostScreen consumes public projected state.
- PlayerScreen consumes one player's projected state and sends input intents.
- DebugPanel remains developer-only.
- A future transport layer should synchronize commands and projected state without letting player-private data leak to HostScreen.

## Explicitly Not Implemented

- online play
- WebSocket transport
- room creation or matchmaking
- smartphone pairing
- QR joining
- authentication
- new roles, modes, boss types, or balance changes
