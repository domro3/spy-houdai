# LAN Device Sync

作成日: 2026-07-01

## 目的

Board端末とPlayer端末を、同じWi-Fi/LAN上の別デバイスで動かす。

GitHub Pages版は静的配信のため、別端末同士のリアルタイム同期はできない。別端末接続を試すときは、ホストPCでLANリレーサーバーを起動する。

## 起動

```bash
npm run serve:lan -- --host 0.0.0.0 --port 8787
```

起動後、ターミナルにLAN用URLが表示される。

例:

```text
Board:  http://192.168.1.10:8787/board
Player: http://192.168.1.10:8787/player/p1
```

## 遊び方

1. ホストPCまたは共有画面で `http://<LAN IP>:8787/board` を開く
2. 各プレイヤー端末で `http://<LAN IP>:8787/player/p1` から `p5` を開く
3. Boardが開いている端末がホストになる
4. Player端末の入力はLANリレー経由でBoardへ送られる
5. 接続済みのプレイヤー入力が揃うと、未接続スロットはCPU補完されて自動進行する

## 制限

- 同じWi-Fi/LAN内で使う
- GitHub Pages公開URLだけでは別端末同期しない
- 外部インターネット越しの常設オンライン対戦ではない
- HTTPSではなくHTTPのローカル検証用
- リレーサーバーを止めると接続は切れる

## 同期方式

- 同一ブラウザ複数タブ: `BroadcastChannel`
- 別端末LAN接続: `EventSource` + `fetch` のHTTPリレー

LAN URLでアクセスした場合、アプリは自動でHTTPリレーを使う。

`?relay=0` を付けるとHTTPリレーを無効化できる。
