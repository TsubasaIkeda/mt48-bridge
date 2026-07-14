import type { Logger } from "./logger.js";
import type { OscMessage } from "./osc-address.js";

/**
 * モニタリングのソース（入力）切り替え。
 *
 * MT48 はソース切り替えを専用イベントでは送ってこない。届くのは
 * `monitoring.monitors` = 全モニターの設定配列で、各モニターの
 * `source_id_list[0]` に現在のソース ID が入っている。
 * 全モニターが同じソースを指すので、実質グローバルな 1 つの値。
 *
 * ID (1001, 1002...) だけでは何のことか分からないため、起動時に
 * ソース名 (DAW, AMP...) を引いて一緒に送る。
 */

export interface Monitor {
  id?: number;
  source_id_list?: number[];
}

/** ソースが 1 つも選ばれていない状態を表す ID。 */
const NO_SOURCE = 0;

/**
 * MT48 の HTTP API でソース定義を引く。
 *
 * WebUI の index.html が使っているのと同じ `/API/get_device_status:<JSONPath>`。
 * CometD には設定ツリー全体のスナップショットが流れてこないので、名前はここから取る。
 */
export async function fetchSourceNames(
  host: string,
  logger: Logger,
  timeoutMs = 5000,
): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  const url = `http://${host}/API/get_device_status:$._oem_ui_process_engine.monitoring.sources`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const body = (await response.json()) as { data?: { value?: unknown } };
    const sources = body.data?.value;
    if (!Array.isArray(sources)) throw new Error("sources が配列ではない");

    for (const source of sources as { id?: number; name?: string }[]) {
      if (typeof source.id === "number" && typeof source.name === "string") {
        names.set(source.id, source.name);
      }
    }
    logger.info("sources:", [...names].map(([id, name]) => `${id}=${name}`).join(", ") || "(なし)");
  } catch (error) {
    // 名前が引けなくても ID は送れる。落とすほどのことではない。
    logger.warn("ソース名を取得できませんでした（ID のみ送出します）:", (error as Error).message);
  }

  return names;
}

export interface SourceTracker {
  /** monitors 配列を受け取り、ソースが変わっていれば OSC を返す。 */
  update: (monitors: readonly Monitor[]) => OscMessage[];
}

export function createSourceTracker(names: ReadonlyMap<number, string>): SourceTracker {
  let previous: number | null = null;

  return {
    update(monitors) {
      // 全モニターが同じソースを指すので先頭を見れば足りる。
      // 空配列 = ソース未選択。
      const current = monitors[0]?.source_id_list?.[0] ?? NO_SOURCE;
      if (previous === current) return [];

      // ボタンと違い、初回も送る。「今どのソースか」は起動直後に知りたい状態なので。
      previous = current;

      return [
        { address: "/mt48/source", args: [{ type: "integer", value: current }] },
        {
          address: "/mt48/source/name",
          args: [{ type: "string", value: names.get(current) ?? "" }],
        },
      ];
    },
  };
}
