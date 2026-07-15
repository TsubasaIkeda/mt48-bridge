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

/**
 * Phone モニターの「番号 -> モニター ID」対応表を引く。
 *
 * Phone のレベルを操作/取得するには、publish 先のモニター ID
 * （実機では Phone1=1502, Phone2=1503 ...）が必要になる。ただし ID の割り当ては
 * 機体差の可能性があるため焼き込まず、起動時に monitors の name ("Phone1" 等) から
 * 番号を解決する。名前はユーザーが変更できるので、既定名から外れていると引けない。
 *
 * @returns 例) Map { 1 => 1502, 2 => 1503, 3 => 1504 }
 */
export async function fetchPhoneMonitors(): Promise<Map<number, number>> {
  const names = await fetchNames("monitors", "id");
  const phones = new Map<number, number>();

  for (const [id, name] of names) {
    const matched = /^phone\s*(\d+)$/i.exec(name.trim());
    if (matched) phones.set(Number.parseInt(matched[1] as string, 10), id);
  }

  log.info("phones:", [...phones].map(([no, id]) => `${no}=id${id}`).join(", ") || "(見つからず)");
  return phones;
}
