# M4 Screen Separation Prototype

Status: local no-facilitator prototype. This is not online play, LAN play, or smartphone support.

## No-Facilitator Direction

M4.6 removes the need for a human facilitator during normal play.

The intended local setup is:

- one `/board` tab on the public central display
- one `/player/:id` tab for each private player screen
- `/debug` only for development and manual fallback

There is still a host authority internally. In M4.6, the host means the board device that owns `GameEngine` and automatically advances phases. It is not a GM screen for normal play.

## Current Architecture

M4 separates the local UI into three screen responsibilities while keeping `GameEngine` as the single source of truth.

- `src/main.tsx`: local app controller, dev setup controls, local route/view selection.
- `src/screens/HostScreen.tsx`: public host/central display.
- `src/screens/PlayerScreen.tsx`: selected local player display and input surface.
- `src/screens/DebugPanel.tsx`: developer-only debug log surface.
- `src/screens/local_routes.ts`: lightweight local path parsing for `/`, `/board`, `/host`, `/player/:id`, and `/debug`.
- `src/screens/screen_view_models.ts`: public/private screen projections used for privacy guardrails.
- `src/local_sync/messages.ts`: serializable local sync message types.
- `src/local_sync/transport.ts`: BroadcastChannel-backed transport wrapper with no-op fallback.
- `src/local_sync/host_session.ts`: host-owned local session controller and automatic phase progression owner.
- `src/local_sync/player_client.ts`: local player client hook for `/player/:id`.

## HostScreen

HostScreen is the public table display. In normal play it is reached through `/board`.

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

M4 post-alpha UI pass adds a public Board preview to `/player/:id`.
This preview is rendered from `HostScreenViewModel.board` and `HostScreenViewModel.players`, not from `GameEngine`.
It may show the same public combat state as the central display, such as round, phase, boss/base HP, boss warning, public input status, public vote totals, and public logs.
It must still not show spy identity, spy-only action names, private logs, debug logs, or manual host controls.

## DebugPanel

DebugPanel is separated from host and player public surfaces.

The `/debug` route is the development/manual fallback. It may show public host state, debug logs, and manual buttons such as reset, CPU fill, resolve, or CPU-only run. These controls are intentionally not part of the normal `/board` view.

## Local Routes

Current routes are local-only:

- `/`: development shell with HostScreen and one local PlayerScreen sharing an in-memory GameEngine in the same tab
- `/board`: public central board with local sync session enabled and automatic phase progression
- `/host`: compatibility alias for `/board`
- `/player/p1` through `/player/p6`: synced PlayerScreen client for that local player id
- `/debug`: development-only manual controls and debug surface

Invalid paths fall back to the development shell. Invalid player ids show a friendly notice and fall back to an available player.

## Local Sync Architecture

M4.5 added a local multi-tab prototype using `BroadcastChannel`. M4.6 keeps that transport model and changes the normal entry point to `/board`.

Authority model:

- `/board` owns `GameEngine`.
- `/board` creates the game, accepts player commands, auto-fills CPU inputs when needed, resolves phases automatically, and broadcasts view models.
- `/host` currently aliases to `/board` for compatibility.
- `/player/:id` does not own `GameEngine` in synced mode.
- `/player/:id` sends command messages to the host and renders the latest player-specific view model.

Command flow:

1. Player tab sends `player_hello` and `request_snapshot`.
2. Host responds with `host_hello`, `state_snapshot`, and `player_view`.
3. Player tab sends commands such as `submit_action` or `submit_vote`.
4. Host validates the command against its `GameEngine`.
5. Host mutates `GameEngine` only if the command is valid.
6. Host broadcasts a fresh public snapshot and one player view per player.

Automatic progression:

- In action, plea, vote, and branch phases, the host waits for all required human-controlled players.
- Once those inputs are present, the host shows a short ready state internally, waits about 800ms, fills CPU/disconnected player inputs, and resolves the phase.
- Stale or duplicate commands after a phase change are rejected by `GameEngine` validation and returned to the sender as local sync errors.
- Normal `/board` play does not require pressing CPU input or resolve buttons.

Message boundaries:

- Host snapshots contain `HostScreenViewModel`.
- Player tabs use the host snapshot for the public Board preview and the targeted player update for private controls.
- Player updates contain `PlayerScreenViewModel` plus a target `playerId`.
- BroadcastChannel is same-origin and local-only. It is not a security boundary.
- The code is structured as per-recipient player messages so a future WebSocket transport can enforce privacy server-side.

## Known Limitations

- BroadcastChannel local sync only works between same-origin tabs on the same browser profile.
- BroadcastChannel is not real networking and does not provide privacy against same-origin developer inspection.
- If `/board` is closed, player tabs move to a waiting/disconnected state.
- Reopening `/board` starts a clear local session from the board tab's current setup.
- The `/` development shell remains single-tab local and is not the sync host.
- `/debug` is for developers and can expose manual controls or debug information. It should not be used as the public table screen.
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
