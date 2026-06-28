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
- `src/local_sync/messages.ts`: serializable local sync message types.
- `src/local_sync/transport.ts`: BroadcastChannel-backed transport wrapper with no-op fallback.
- `src/local_sync/host_session.ts`: host-owned local session controller.
- `src/local_sync/player_client.ts`: local player client hook for `/player/:id`.

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

The `View as Player` selector in the `/` development shell is only for local development. It is not an authentication or device ownership system.

On `/player/:id`, PlayerScreen is rendered from a player-specific view model received from the local host session. It does not own or resolve `GameEngine` directly.

## DebugPanel

DebugPanel is separated from host and player public surfaces.

The `/debug` route shows DebugPanel without HostScreen or PlayerScreen. The default `/` development shell may also show it for quick local inspection.

## Local Routes

Current routes are local-only:

- `/`: development shell with HostScreen and one local PlayerScreen sharing an in-memory GameEngine in the same tab
- `/host`: authoritative HostScreen with local sync session enabled
- `/player/p1` through `/player/p6`: synced PlayerScreen client for that local player id
- `/debug`: DebugPanel only

Invalid paths fall back to the development shell. Invalid player ids show a friendly notice and fall back to an available player.

## Local Sync Architecture

M4.5 adds a local multi-tab prototype using `BroadcastChannel`.

Authority model:

- `/host` owns `GameEngine`.
- `/host` creates the game, accepts player commands, runs CPU fill, resolves phases, and broadcasts view models.
- `/player/:id` does not own `GameEngine` in synced mode.
- `/player/:id` sends command messages to the host and renders the latest player-specific view model.

Command flow:

1. Player tab sends `player_hello` and `request_snapshot`.
2. Host responds with `host_hello`, `state_snapshot`, and `player_view`.
3. Player tab sends commands such as `submit_action` or `submit_vote`.
4. Host validates the command against its `GameEngine`.
5. Host mutates `GameEngine` only if the command is valid.
6. Host broadcasts a fresh public snapshot and one player view per player.

Message boundaries:

- Host snapshots contain `HostScreenViewModel`.
- Player updates contain `PlayerScreenViewModel` plus a target `playerId`.
- BroadcastChannel is same-origin and local-only. It is not a security boundary.
- The code is structured as per-recipient player messages so a future WebSocket transport can enforce privacy server-side.

## Known Limitations

- BroadcastChannel local sync only works between same-origin tabs on the same browser profile.
- BroadcastChannel is not real networking and does not provide privacy against same-origin developer inspection.
- If `/host` is closed, player tabs move to a waiting/disconnected state.
- Reopening `/host` starts a clear local session from the host tab's current setup.
- The `/` development shell remains single-tab local and is not the sync host.
- There are no rooms, WebSockets, LAN discovery, QR codes, authentication, or smartphone-specific controls.
- The route structure is a prototype for future separation, not a networking layer.

## Future Path

Future local network or online work should keep this boundary:

- GameCore/GameEngine remains authoritative.
- HostScreen consumes public projected state.
- PlayerScreen consumes one player's projected state and sends input intents.
- DebugPanel remains developer-only.
- A future WebSocket or local network transport should replace `transport.ts` while preserving the message/view-model boundary.
- Future server-side transport must enforce that each player receives only their own private view.

## Explicitly Not Implemented

- online play
- WebSocket transport
- LAN transport
- room creation or matchmaking
- smartphone pairing
- QR joining
- authentication
- new roles, modes, boss types, or balance changes
