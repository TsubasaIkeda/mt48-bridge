# MT48 → Max/MSP CometD/OSC Bridge

Neumann MT48 の物理操作（ボリュームノブ、ボタン）を Max/MSP に流し込むためのブリッジ。

MT48 の WebUI が使っているのと同じ CometD/Bayeux チャネルを Node.js から購読し、届いた変更通知を OSC メッセージとして UDP 送信します。
接続安定性を優先し、CometD は **long-polling 固定**で動作します。

TypeScript + Vite + Biome 構成。読み取り（MT48 → Max）専用です。

## 動作の概略

```
[MT48 物理ノブ/ボタン]
         │
         ▼
[MT48 内蔵 Web サーバ: http://<MT48_IP>/cometd]
         │  CometD/Bayeux (long-polling)
         ▼
[bridge (このフォルダ)]
         │  UDP / OSC (default 127.0.0.1:7400)
         ▼
[Max: udpreceive 7400 → route]
```

## セットアップ

```bash
node -v        # v20 以上
npm install
```

## 起動

```bash
# 開発中（TypeScript を直接実行）
npm run dev

# ビルドして実行
npm run build
npm start
```

**MT48_HOST を指定しなければ、起動時に自動で MT48 を探します。**
明示したい場合は環境変数で指定します。

```bash
MT48_HOST=169.254.13.240 npm run dev   # IP 直指定
OSC_HOST=127.0.0.1 OSC_PORT=7400 npm run dev
METERS=1 npm run dev                   # メータも流す（高頻度・帯域注意）
LOG=debug npm run dev                  # 送出する OSC を全部ログに出す
```

| 環境変数 | 既定値 | 内容 |
|---|---|---|
| `MT48_HOST` | （自動探索） | MT48 の IP。未指定なら探しに行く |
| `OSC_HOST` | `127.0.0.1` | OSC 送信先ホスト |
| `OSC_PORT` | `7400` | OSC 送信先ポート |
| `METERS` | （無効） | `1` でメータ系チャネルも購読 |
| `LOG` | （無効） | `debug` で詳細ログ |

起動するとこう出ます：

```
[bridge] MT48 CometD: http://169.254.13.240/cometd
[bridge] OSC out:     127.0.0.1:7400
[bridge] Meters:      OFF
[bridge] CometD transport: long-polling (forced)
[bridge] connected, clientId = 0x...
[bridge] subscribed /ravenna/settings
[bridge] subscribed /ravenna/status
```

MT48 のボリュームノブを回すと、Max 側で次の OSC を受信します：

```
/mt48/volume -85
/mt48/volume -90
```

## MT48 が見つからないとき

**MT48 はリンクローカル（`169.254.x.x`）で自動採番されるため、再起動やケーブルの抜き差しで IP が変わります。**
「昨日まで動いていたのに OSC が来ない」の原因はほぼこれです。

```bash
npm run discover
```

ARP 近傍を CometD ハンドシェイクで叩いて、MT48 の現在の IP を突き止めます。
見つからない場合は物理層を疑ってください：

- Ethernet ケーブルが挿さっているか（`ifconfig` に該当インターフェースが出るか）
- Mac 側が同一セグメントか（手動 IP `169.254.x.x` か「リンクローカルのみ」）
- 手で確認する場合：

```bash
curl -si -X POST "http://<MT48_IP>/cometd" \
  -H "Content-Type: application/json;charset=UTF-8" \
  --data '[{"id":"1","version":"1.0","minimumVersion":"1.0","channel":"/meta/handshake","supportedConnectionTypes":["long-polling"]}]'
# "successful":true が返ればOK
```

## OSC アドレス

**よく使うパラメータは短いアドレスに、それ以外は取りこぼさず `/mt48/raw/...` に流します。**

| 内容 | OSC アドレス | 値 |
|---|---|---|
| ボリューム | `/mt48/volume` | `-85` |
| ミュート | `/mt48/mute` | `0` / `1` |
| DIM | `/mt48/dim` | `0` / `1` |
| 選択中のモニター | `/mt48/selected_monitor_id` | `1500` |
| **モニタリングのソース** | `/mt48/source` | `1002` |
| ソース名 | `/mt48/source/name` | `AMP` |
| モニターの Mono/Downmix | `/mt48/monitor/1500/mono` | `0` / `1` |
| **フロントパネルのボタン** | `/mt48/button/<name>` | `0` / `1` |
| ボタンの LED 色 | `/mt48/button/<name>/color` | `#ff3f00` |
| ノブの状態 | `/mt48/hw/rotary/...` | |
| 上記以外すべて | `/mt48/raw/<パス>` | |

### フロントパネルのボタン

**MT48 は「ボタンが押された」というイベントを送ってきません。**
送ってくるのは各ボタンの LED 状態（id・ラベル・背景色）の配列で、押すとその色が変わります。
そこでブリッジ側で前回状態との差分を取り、**変化したボタンだけ**を送ります。

```
/mt48/button/speaker_b 1          ← SPEAKER B を押して点灯
/mt48/button/speaker_b/color #ff3f00
/mt48/button/speaker_a 0          ← 排他なので A は同時に消灯
/mt48/button/speaker_a/color #1a1a1a
```

実機で観測したボタンの対応：

| id | ラベル | OSC アドレス | 点灯色 |
|---|---|---|---|
| 1 | A (Speaker) | `/mt48/button/speaker_a` | `#ffff8f` |
| 2 | B (Speaker) | `/mt48/button/speaker_b` | `#ff3f00` |
| 3 | 1 (Headphone) | `/mt48/button/phones_1` | `#10d708` |
| 4 | 2 (Headphone) | `/mt48/button/phones_2` | `#bfbf00` |
| 101 | 3 (HeadphoneVK) | `/mt48/button/phones_3` | `#f4383a` |
| 6 | （不明） | `/mt48/button/key_6` | `#960000` |
| 5, 200 | （不明・変化を観測せず） | `/mt48/button/key_5` など | — |

点灯/消灯の `0` / `1` は、ボタンごとの**消灯色**（`src/hw-buttons.ts` の `OFF_COLORS`）との比較で決めています。
消灯色が未登録の id は `0`/`1` を出さず、`/color` だけを送ります。
ボタンの名前や消灯色を足したいときは `src/hw-buttons.ts` の `BUTTON_NAMES` / `OFF_COLORS` に追記してください。

なお接続直後の 1 回目は差分の基準を作るだけで送出しません
（送ると、繋いだだけで全ボタンを押したかのような OSC が飛ぶため）。

### モニタリングのソース

こちらも専用イベントはありません。届くのは `monitoring.monitors` = 全モニターの設定配列で、
各モニターの `source_id_list[0]` に現在のソース ID が入っています。
全モニターが同じ値を指すため、実質グローバルな 1 つの値です。

```
/mt48/source 1002
/mt48/source/name AMP
```

ID だけでは何のことか分からないので、**起動時にソース名を引いて一緒に送ります**。
名前の取得には MT48 の HTTP API を使っています（WebUI の `index.html` が使っているのと同じもの）。

```bash
curl "http://<MT48_IP>/API/get_device_status:\$._oem_ui_process_engine.monitoring.sources"
# => [{"id":1001,"name":"DAW",...},{"id":1002,"name":"AMP",...}]
```

この API は任意の JSONPath でツリーを引けるので、パス構造を調べるときにも便利です。
CometD には設定ツリー全体のスナップショットが流れてこないため、名前の類はここから取ります。
名前が引けなかった場合は警告を出し、ID だけを送ります（`/mt48/source/name` は空文字）。

ボタンと違い、**ソースは接続直後にも 1 回送ります**（「今どれが選ばれているか」は起動時に知りたい状態のため）。

- **boolean は `0` / `1` の整数**で送ります（OSC の `T`/`F` 型タグだと値を伴わず、Max の toggle に直結できないため）
- 整数と小数は OSC の型タグで撃ち分けます（`i` / `f`）
- プリミティブ配列は 1 メッセージに複数引数としてまとめます（メータ値など）
- ネストしたオブジェクトはアドレスに平坦化します（`{a:{b:1}}` → `/.../a/b 1`）

短縮したいアドレスが増えたら、`src/osc-address.ts` の `ALIAS_RULES` に 1 行足すだけです。
足さなくても `/mt48/raw/...` で流れ続けるので、取りこぼしは起きません。

```ts
const ALIAS_RULES = [
  ["oem_ui_process_engine/monitoring/speaker_set/*", "{0}"],   // -> /mt48/volume, /mt48/mute ...
  ["oem_ui_process_engine/monitoring/monitors/*/downmix/*", "monitor/{0}/{1}"],
  // ...
];
```

どのアドレスが実際に流れているか分からないときは `LOG=debug npm run dev`、
または Max の `print osc-raw` を見てください。

## Max/MSP 側

`mt48_receiver.maxpat` を開くと `udpreceive 7400` から受け取る雛形パッチが立ち上がります。
**外部オブジェクトは不要**です（短縮アドレスにしたことで、素の `route` で扱えるようになりました）。

```
udpreceive 7400
  ├─ print osc-raw                                  ← 全 OSC をコンソールへ
  ├─ route /mt48/volume /mt48/mute /mt48/dim
  │    ├─ flonum   (volume)
  │    ├─ toggle   (mute)
  │    └─ toggle   (dim)
  └─ route /mt48/button/speaker_a ... /mt48/button/phones_3
       ├─ toggle × 5   (SPK A / SPK B / PH 1 / PH 2 / PH 3)
       └─ print osc-unrouted                        ← それ以外
```

Max の `route` は**アドレスの完全一致**でしか拾えません。
`/mt48/monitor/1500/mono` や `/mt48/hw/...` のように階層で変動するアドレスをまとめて拾いたい場合は、
CNMAT の `OSC-route`（Package Manager から CNMAT-odot）を使ってください。

## 開発

```bash
npm run dev        # TypeScript を直接実行
npm run build      # dist/bridge.js を生成
npm run typecheck  # tsc --noEmit
npm run lint       # Biome
npm run format     # Biome（自動修正）
npm run discover   # MT48 の IP を探す
```

### ファイル構成

```
mt48-bridge/
├── src/
│   ├── main.ts              # 起動・CometD 購読・OSC 送出の配線
│   ├── config.ts            # 環境変数
│   ├── discover.ts          # MT48 の IP 自動探索
│   ├── discover-cli.ts      # `npm run discover` の入口
│   ├── hw-buttons.ts        # フロントパネルのボタン（LED 差分 -> 押下）
│   ├── sources.ts           # モニタリングのソース切り替え
│   ├── osc-address.ts       # CometD パス -> OSC アドレス変換（中核）
│   ├── osc-sender.ts        # UDP/OSC 送信
│   └── logger.ts
├── mt48_receiver.maxpat     # Max 受信側 雛形
├── vite.config.ts
├── biome.json
└── tsconfig.json
```

### 依存について

OSC の送出には `osc-min`（依存ゼロ）＋ Node 標準の `dgram` を使っています。
以前使っていた `osc` パッケージは WebSocket（`ws`）と `serialport` を引きずり込み、
UDP 送信しかしない本ブリッジには不要な上に `ws` の既知脆弱性を持ち込んでいたため置き換えました。

## 観測済みのチャネルとパス

| チャネル | パス例 | 内容 |
|---|---|---|
| `/ravenna/settings` | `$._oem_ui_process_engine.monitoring.speaker_set` | ボリューム、ミュート等 |
| `/ravenna/settings` | `$._oem_ui_process_engine.monitoring.monitors[?(@.id==1500)][0].downmix` | Mono / DOWNMIX |
| `/ravenna/settings` | `$._oem_ui_process_engine.remote_hw_event` | 物理ボタン/ノブ |
| `/ravenna/status` | `$` | 初期状態スナップショット（巨大なので通常は捨てる） |
| `/ravenna/meter` | `$._modules[?(@.id==N)][0]` | モジュールメータ（高頻度）|
| `/ravenna/monitoring_meters` | `$._oem_ui_process_engine.monitoring_meters` | モニタメータ（高頻度）|

## 制限事項・注意

- **読み取り（MT48 → Max）専用**。MT48 への書き戻し（制御）は未実装
- CometD は内部 API であり、ファームウェア更新でチャネル名やパス構造が変わる可能性あり
- MT48 ファームウェア 1.8.0 以降は本体に OSC 出力機能があるため、用途が単純なら
  **MT48 本体の OSC 出力 → Max** の直接経路の方が依存が少なく安定
- 動作確認した観測対象は WebUI 上のモニタリングセクションのみ。プリアンプ/ルーティング画面のパス構造は未調査
