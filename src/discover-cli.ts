/**
 * `npm run discover` の入口。MT48 の現在の IP を探して表示するだけ。
 *
 * discover.ts 側に「自分が直接実行されたか」を判定させると、実行方法
 * (vite-node / node dist) によって process.argv の中身が変わって壊れるので、
 * CLI はこうして独立したエントリに分けている。
 */
import { discoverHost } from "./discover.js";
import { createLogger } from "./logger.js";

const logger = createLogger(process.env.LOG === "debug");
const host = await discoverHost(logger);

if (host) {
  logger.info(`見つかりました。次のように起動できます:\n\n  MT48_HOST=${host} npm run dev\n`);
} else {
  logger.error(
    "MT48 が見つかりません。Ethernet ケーブルが挿さっているか、Mac 側が同一セグメント" +
      "（手動 IP 169.254.x.x か「リンクローカルのみ」）かを確認してください。",
  );
  process.exitCode = 1;
}
