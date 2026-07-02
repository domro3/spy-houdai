# Phone Device Sync

作成日: 2026-07-02

## 目的

PCでLANリレーサーバーを起動せず、スマホだけでBoard端末とPlayer端末を同期する。

この方式はGitHub Pagesの静的公開URLで動く。1台のスマホがBoardホストになり、他のスマホがroom付きPlayerリンクで参加する。

## 起動

公開URLでBoardを開く。

```text
https://domro3.github.io/spy-houdai/board
```

Board画面は自動でスマホ同期roomを作り、URLに `sync=phone&room=<ROOM>` を付ける。

例:

```text
https://domro3.github.io/spy-houdai/board?sync=phone&room=ABC123
```

## 参加

Board画面に表示されるP1-P6リンクを各スマホで開く。

例:

```text
https://domro3.github.io/spy-houdai/player/p1?sync=phone&room=ABC123
```

## 同期方式

- Boardスマホ: room固定のPeerJSホストになる
- Playerスマホ: 同じroomのPeerJSホストへ接続する
- シグナリング: PeerJS Cloud
- ゲーム通信: WebRTC DataChannel

PeerJS Cloudは接続開始のシグナリングに使う。ゲーム入力や状態同期はWebRTCのデータチャネルで送る。

## 制限

- 常設の公開マッチメイキングではない
- room一覧、入室管理、認証、キック機能はない
- TURNサーバーは未設定のため、一部のモバイル回線や厳しいNAT環境では接続できない
- Boardスマホを閉じるとroomは終了する
- room URLを知っている端末は参加できるため、信頼できる範囲で共有する

## 既存方式との違い

- 同じブラウザ内の複数タブ: `BroadcastChannel`
- 同じWi-Fi/LANでPCホストあり: `EventSource` + `fetch` のLAN HTTPリレー
- スマホだけ: PeerJS + WebRTC DataChannel
