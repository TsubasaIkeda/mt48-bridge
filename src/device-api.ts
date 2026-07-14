import { config, log } from "./env.js";

/**
 * MT48 の HTTP API から、ボタン名 / ソース名の対応表を引く。
 *
 * `/API/get_device_status:<JSONPath>` で設定ツリーの任意の場所を引ける
 * （WebUI の index.html が使っているのと同じもの）。CometD には設定ツリー全体の
 * スナップショットが流れてこないため、名前のような「変化しない定義」はここから取る。
 *
 * 名前は MT48 側でユーザーが変更できるので、ソースには焼き込まない。
 *
 * @param key      monitoring 配下のキー（"monitors" / "sources"）
 * @param keyField 対応表のキーにするフィールド（ボタンは button_id、ソースは id）
 */
export async function fetchNames(
  key: "monitors" | "sources",
  keyField: "id" | "button_id",
): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  const url = `http://${config.host}/API/get_device_status:$._oem_ui_process_engine.monitoring.${key}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const body = (await response.json()) as { data?: { value?: unknown } };
    const entries = body.data?.value;
    if (!Array.isArray(entries)) throw new Error(`${key} が配列ではない`);

    for (const entry of entries as { id?: number; name?: string; button_id?: number }[]) {
      const id = entry[keyField];
      if (typeof id === "number" && typeof entry.name === "string") {
        names.set(id, entry.name);
      }
    }
    log.info(`${key}:`, [...names].map(([id, name]) => `${id}=${name}`).join(", ") || "(なし)");
  } catch (error) {
    // 名前が引けなくても ID は送れる。落とすほどのことではない。
    log.warn(`${key} の名前を取得できません（ID のみ送出します）:`, (error as Error).message);
  }

  return names;
}
