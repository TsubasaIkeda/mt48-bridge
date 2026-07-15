# MT48 → Max/MSP CometD/OSC Bridge

Neumann MT48 の物理操作（ボリュームノブ、ボタン）を Max/MSP に流し込むためのブリッジ。

MT48 の WebUI が使っているのと同じ CometD/Bayeux チャネルを Node.js から購読し、届いた変更通知を OSC メッセージとして UDP 送信します。加えて、Max から届いた OSC を CometD publish に変換して **MT48 を制御**します（メインの Mute、Phone レベル）。
接続安定性を優先し、CometD は **long-polling 固定**で動作します。

TypeScript + Vite + Biome 構成。読み取り（MT48 → Max）と、一部パラメータの書き込み（Max → MT48）に対応します。

## 動作の概略

```
[MT48 物理ノブ/ボタン]                    [Max: udpsend 7500]
         │                                        │
         ▼                                        ▼  UDP / OSC (control)
[MT48 内蔵 Web サーバ: http://<MT48_IP>/cometd]   │
         │  CometD/Bayeux (long-polling)          │
         ▼                                        │
[bridge (このフォルダ)] ◀───────────────────────┘
         │  UDP / OSC (default 127.0.0.1:7400)
         ▼
[Max: udpreceive 7400 → route]
```

- **読み取り (MT48 → Max)**: CometD 購読 → OSC 送信（`OSC_PORT`, 既定 7400）
- **書き込み (Max → MT48)**: OSC 受信（`OSC_IN_PORT`, 既定 7500）→ CometD publish

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

設定はすべて環境変数です。

```bash
MT48_HOST=192.168.0.22 npm run dev      # MT48 の IP
OSC_HOST=127.0.0.1 OSC_PORT=7400 npm run dev    # 送信先（MT48 → Max）
OSC_IN_PORT=7500 npm run dev            # 受信ポート（Max → MT48 の制御）
METERS=1 npm run dev                    # メータも流す（高頻度・帯域注意）
LOG=debug npm run dev                   # 送受信する OSC を全部ログに出す
```

| 環境変数 | 既定値 | 内容 |
|---|---|---|
| `MT48_HOST` | `192.168.0.22` | MT48 の IP |
| `OSC_HOST` | `127.0.0.1` | OSC 送信先ホスト（MT48 → Max） |
| `OSC_PORT` | `7400` | OSC 送信先ポート（MT48 → Max） |
| `OSC_IN_HOST` | `0.0.0.0` | OSC 受信の待ち受けホスト（Max → MT48） |
| `OSC_IN_PORT` | `7500` | OSC 受信の待ち受けポート（Max → MT48） |
| `RECONNECT_INTERVAL` | `30000` | 接続断時の再 handshake 間隔（ミリ秒） |
| `METERS` | （無効） | `1` でメータ系チャネルも購読 |
| `LOG` | （無効） | `debug` で詳細ログ |

起動するとこう出ます：

```
[bridge] MT48 CometD: http://192.168.0.22/cometd
[bridge] OSC out:     127.0.0.1:7400
[bridge] OSC in:      0.0.0.0:7500
[bridge] Meters:      OFF
[bridge] monitors: 1=Stereo, 2=Atmos, 3=Phone1, 4=Phone2, 101=Phone3
[bridge] sources: 1001=DAW, 1002=AMP
[bridge] phones: 1=id1502, 2=id1503, 3=id1504
[bridge] OSC in: listening 0.0.0.0:7500
[bridge] connected, clientId = 0x...
[bridge] subscribed /ravenna/settings
[bridge] subscribed /ravenna/status
```

MT48 のボリュームノブを回すと、Max 側で次の OSC を受信します：

```
/mt48/volume -85
/mt48/volume -90
```

## OSC が来ないとき

**まず MT48 の IP を疑ってください。** IP が変われば当然つながりません。

```bash
ping <MT48_IP>

curl -si -X POST "http://<MT48_IP>/cometd" \
  -H "Content-Type: application/json;charset=UTF-8" \
  --data '[{"id":"1","version":"1.0","minimumVersion":"1.0","channel":"/meta/handshake","supportedConnectionTypes":["long-polling"]}]'
# "successful":true が返ればOK
```

Ethernet 直結でリンクローカル（`169.254.x.x`）を使う場合は、
Mac 側も同一セグメント（手動 IP `169.254.x.x` か「リンクローカルのみ」）にしてください。
リンクローカルは再起動やケーブルの抜き差しで IP が変わります。

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
| **Phone のレベル** | `/mt48/phone/<n>/volume` | `-295`（0.1dB 単位） |
| モニターの Mono/Downmix | `/mt48/monitor/1500/mono` | `0` / `1` |
| **フロントパネルのボタン** | `/mt48/button/<id>` | `0` / `1` |
| ボタンの名前 | `/mt48/button/<id>/name` | `Phone2` |
| ボタンの LED 色 | `/mt48/button/<id>/color` | `#ff3f00` |
| **最後に状態が変わったボタン** | `/mt48/button/last` | `2` |
| ノブの状態 | `/mt48/hw/rotary/...` | |
| 上記以外すべて | `/mt48/raw/<パス>` | |

`/mt48/phone/<n>/volume` の `<n>` は Phone 番号（1, 2, 3 …）。実機のモニター ID
（Phone1=1502 …）は機体差の可能性があるため焼き込まず、起動時にモニター名 `Phone1` …
から番号を解決します（`src/device-api.ts`）。名前を既定から変えていると解決できません。

### フロントパネルのボタン

**MT48 は「ボタンが押された」というイベントを送ってきません。**
送ってくるのは各ボタンの LED 状態（id・ラベル・背景色）の配列で、押すとその色が変わります。
そこでブリッジ側で前回状態との差分を取り、**変化したボタンだけ**を送ります。

アドレスは**ボタン ID** です。ボタンはモニターと 1 対 1 で対応しており
（`monitors[].button_id`）、その名前（Stereo, Phone1 …）は MT48 側で変更できます。
名前をソースに焼き込むと実機とズレるので、**名前は起動時に引いて併せて送ります**。

```
/mt48/button/2 1                  ← ボタン 2 (Atmos) を押して点灯
/mt48/button/2/name Atmos
/mt48/button/2/color #ff3f00
/mt48/button/1 0                  ← 排他なのでボタン 1 (Stereo) は同時に消灯
/mt48/button/1/name Stereo
/mt48/button/1/color #1a1a1a
/mt48/button/last 2               ← 最後に状態が変わったボタンの ID
```

`/mt48/button/last` は、状態が変わったボタンの ID を 1 つだけ出します。
上のように同時に複数変わる場合（押した方が点灯・前の選択が消灯）は、
**点灯した方＝操作したボタン**を優先します（どれも点灯しなければ最後に変わった ID）。

対象は**モニターに対応する（名前のある）ボタンだけ**です。Speaker B（id=6）のような
名無しボタンは、スピーカー切り替え等で変化しても `last` には出しません
（個別の `/mt48/button/6` は従来どおり出ます）。

ヘッドフォン（Phone）を消灯し、かつどのボタンも点灯しなかったときは、
**そのとき点灯しているスピーカーの ID** を `last` にします。ヘッドフォンを外して
スピーカー監視へ戻ったことを Max 側で拾えるようにするためです
（点灯しているスピーカーが無ければ、消灯したヘッドフォンの ID を出します）。

実機で観測したボタン：

| ボタン ID | 対応するモニター | 点灯色 | 消灯色 |
|---|---|---|---|
| 1 | Stereo | `#ffff8f` | `#1a1a1a` |
| 2 | Atmos | `#ff3f00` | `#1a1a1a` |
| 3 | Phone1 | `#10d708` | `#1a1a1a` |
| 4 | Phone2 | `#bfbf00` | `#1a1a1a` |
| 101 | Phone3（仮想キー） | `#f4383a` | `#a0a0a0` |
| 102 | Phone4（仮想キー） | `#f4383a` | `#a0a0a0` |
| 103 | Phone5（仮想キー） | `#f4383a` | `#a0a0a0` |
| 104 | Phone6（仮想キー） | `#f4383a` | `#a0a0a0` |
| 6 | （不明・モニター非対応） | `#960000` | `#0d0d0d` |
| 5, 200 | （不明・変化を観測せず） | — | — |

点灯/消灯の `0` / `1` は、ボタンごとの**消灯色**（`src/hw-buttons.ts` の `OFF_COLORS`）との比較で決めています。
点灯色はボタンごとに違いますが、消灯色は一定なのでこの方法が使えます。
消灯色が未登録の id は `0`/`1` を出さず、`/name` と `/color` だけを送ります。

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

ボタンと違い、**ソースは接続直後にも 1 回送ります**（「今どれが選ばれているか」は起動時に知りたい状態のため）。

### 名前はどこから来るか（MT48 の HTTP API）

ボタン名もソース名も **MT48 側でユーザーが変更できる**ため、ソースコードには焼き込まず、
起動時に MT48 から引いています（`src/device-api.ts`）。

CometD には設定ツリー全体のスナップショットが流れてこないので、
WebUI の `index.html` が使っているのと同じ HTTP API を叩きます。

```bash
curl "http://<MT48_IP>/API/get_device_status:\$._oem_ui_process_engine.monitoring.sources"
# => [{"id":1001,"name":"DAW",...},{"id":1002,"name":"AMP",...}]

curl "http://<MT48_IP>/API/get_device_status:\$._oem_ui_process_engine.monitoring.monitors"
# => [{"id":1500,"name":"Stereo","button_id":1,...}, ...]
```

`/API/get_device_status:<JSONPath>` は任意の JSONPath でツリーを引けるので、
パス構造を調べるときにも便利です。

名前が引けなかった場合は警告を出すだけで起動は続行し、ID だけを送ります。

```
[bridge] monitors: 1=Stereo, 2=Atmos, 3=Phone1, 4=Phone2, 101=Phone3
[bridge] sources: 1001=DAW, 1002=AMP
```

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

## 制御（Max → MT48）

Max から `OSC_IN_PORT`（既定 7500）へ OSC を送ると、MT48 を操作できます。
書き込みは WebUI と同じく CometD の `/service/ravenna/settings` へ `{ path, value }` を
publish する方式です（`src/control.ts`）。**対応アドレスのみを受け付け**、未知のアドレスは
無視します（誤爆で実機を触らないためのホワイトリスト方式）。

| 操作 | 送る OSC | 値 |
|---|---|---|
| メイン Mute / 解除 | `/mt48/main/mute` | `1`=ミュート / `0`=解除 |
| メイン Volume | `/mt48/main/volume` | `-200`（0.1dB 単位の整数） |
| Phone レベル | `/mt48/phone/<n>/volume` | `-295`（0.1dB 単位の整数、`<n>`=Phone 番号） |

- volume は**実機の生値（0.1dB 単位）**。`-200` = −20.0dB、`0` = 0dB、`+120` = +12dB。
  読み取り側の `/mt48/volume` / `/mt48/phone/<n>/volume` と同じスケールなので往復できます。
- 範囲は WebUI と同じ `-960`〜`+120` に丸めます。
- 未接続のときに送られた制御は捨てます（届かないため）。
- Phone レベルは操作するとその変化が読み取り側にも `/mt48/phone/<n>/volume` として返ります。

```bash
# 例: Max の [udpsend 127.0.0.1 7500] から
/mt48/main/mute 1          # メインをミュート
/mt48/main/mute 0          # 解除
/mt48/phone/1/volume -300  # Phone1 を −30.0dB へ
```

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
  ├─ route /mt48/button/1 /mt48/button/2 /mt48/button/3 /mt48/button/4 /mt48/button/101 /mt48/button/102 /mt48/button/103 /mt48/button/104
  │    ├─ toggle × 9   (Stereo / Atmos / Phone1 / Phone2 / Phone3 / Phone4 / Phone5 / Phone6)
  │    └─ print osc-unrouted                        ← それ以外
  └─ route /mt48/source /mt48/source/name
       ├─ number    (source id)
       └─ message   (source 名)
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
```

### ファイル構成

```
mt48-bridge/
├── src/
│   ├── main.ts              # 起動・CometD 購読/publish・OSC 送受信の配線
│   ├── env.ts               # 環境変数とログ
│   ├── device-api.ts        # MT48 の HTTP API（ボタン名 / ソース名 / Phone ID の取得）
│   ├── hw-buttons.ts        # フロントパネルのボタン（LED 差分 -> 押下）
│   ├── sources.ts           # モニタリングのソース切り替え
│   ├── osc-address.ts       # CometD パス -> OSC アドレス変換（中核）
│   ├── osc-sender.ts        # UDP/OSC 送信（MT48 -> Max）
│   ├── osc-receiver.ts      # UDP/OSC 受信（Max -> MT48）
│   └── control.ts           # 受信 OSC -> CometD publish（制御）
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

- 書き込み（制御）はメイン Mute / メイン Volume / Phone レベルのみ対応。それ以外の操作は未実装
- CometD は内部 API であり、ファームウェア更新でチャネル名やパス構造が変わる可能性あり
- MT48 ファームウェア 1.8.0 以降は本体に OSC 出力機能があるため、用途が単純なら
  **MT48 本体の OSC 出力 → Max** の直接経路の方が依存が少なく安定
- 動作確認した観測対象は WebUI 上のモニタリングセクションのみ。プリアンプ/ルーティング画面のパス構造は未調査
