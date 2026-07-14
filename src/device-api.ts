import type { Logger } from "./logger.js";

/**
 * MT48 の HTTP API。
 *
 * `/API/get_device_status:<JSONPath>` で設定ツリーの任意の場所を引ける。
 * WebUI の index.html が使っているのと同じもの。
 *
 * CometD には設定ツリー全体のスナップショットが流れてこないため、
 * ソース名やモニター名のような「変化しない定義」はここから取る。
 */
export async function getDeviceStatus(
  host: string,
  jsonPath: string,
  timeoutMs = 5000,
): Promise<unknown> {
  const url = `http://${host}/API/get_device_status:${jsonPath}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const body = (await response.json()) as { data?: { value?: unknown } };
  return body.data?.value;
}

/** id と name を持つ定義（sources, monitors など）。 */
interface NamedEntry {
  id?: number;
  name?: string;
  button_id?: number;
}

/**
 * `monitoring.<key>` の配列を引き、<keyField> -> name の対応表にする。
 * 引けなくても致命的ではない（ID だけは送れる）ので、失敗時は空の表を返す。
 */
export async function fetchNames(
  host: string,
  key: string,
  keyField: "id" | "button_id",
  logger: Logger,
): Promise<Map<number, string>> {
  const names = new Map<number, string>();

  try {
    const value = await getDeviceStatus(host, `$._oem_ui_process_engine.monitoring.${key}`);
    if (!Array.isArray(value)) throw new Error(`${key} が配列ではない`);

    for (const entry of value as NamedEntry[]) {
      const id = entry[keyField];
      if (typeof id === "number" && typeof entry.name === "string") {
        names.set(id, entry.name);
      }
    }
    logger.info(`${key}:`, [...names].map(([id, name]) => `${id}=${name}`).join(", ") || "(なし)");
  } catch (error) {
    logger.warn(
      `${key} の名前を取得できませんでした（ID のみ送出します）:`,
      (error as Error).message,
    );
  }

  return names;
}
