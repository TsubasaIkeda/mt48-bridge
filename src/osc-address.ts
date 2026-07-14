/**
 * CometD の JSONPath + 値 を、Max で扱いやすい OSC メッセージへ変換する。
 *
 * 方針:
 *   - よく使うパラメータは短いエイリアスへマッピング（例: /mt48/volume）
 *   - マッピングの無いパスは /mt48/raw/... へフォールバックし、取りこぼさない
 *   - boolean は Max の toggle にそのまま繋げられるよう 0/1 の整数で送る
 */

export type OscArg =
  | { type: "integer"; value: number }
  | { type: "float"; value: number }
  | { type: "string"; value: string };

export interface OscMessage {
  address: string;
  args: OscArg[];
}

/** OSC アドレスで使えない文字 (OSC 1.0 spec): 空白 # * , / ? [ ] { } */
const INVALID_ADDRESS_CHARS = /[\s#*,/?[\]{}]/g;

const sanitizeSegment = (segment: string): string => segment.replace(INVALID_ADDRESS_CHARS, "_");

/**
 * JSONPath を OSC アドレスのセグメント列へ正規化する。
 *
 *   $._oem_ui_process_engine.monitoring.speaker_set
 *     -> ["oem_ui_process_engine", "monitoring", "speaker_set"]
 *   $._oem_ui_process_engine.monitoring.monitors[?(@.id==1500)][0].downmix
 *     -> ["oem_ui_process_engine", "monitoring", "monitors", "1500", "downmix"]
 *   $  -> []
 */
export function pathToSegments(jsonPath: string | undefined): string[] {
  if (!jsonPath) return [];

  const withoutRoot = jsonPath
    // JSONPath フィルタ [?(@.id==N)][0] は ID セグメントへ畳む
    .replace(/\[\?\(\s*@\.id\s*==\s*([\w-]+)\s*\)\]\[0\]/g, ".$1")
    // 素の配列インデックス [n]
    .replace(/\[(\d+)\]/g, ".$1")
    // 先頭の $ / $.
    .replace(/^\$\.?/, "");

  return (
    withoutRoot
      .split(".")
      .filter((segment) => segment.length > 0)
      // MT48 の内部キーは _ 始まり (_modules, _oem_ui_process_engine) なので剥がす
      .map((segment) => sanitizeSegment(segment.replace(/^_+/, "")))
  );
}

/**
 * エイリアス規則。上から順に評価し、最初に一致したものを使う。
 * `*` は 1 セグメントに一致し、置換先の {0} {1} ... で参照できる。
 *
 * 新しいパラメータを短縮したくなったら、ここに 1 行足すだけでよい。
 * （未知のパスは raw/ で流れ続けるので、追加しなくても取りこぼしはない）
 */
const ALIAS_RULES: ReadonlyArray<readonly [pattern: string, alias: string]> = [
  // --- モニタリング: スピーカーセット (ボリューム/ミュート/DIM 等) ---
  ["oem_ui_process_engine/monitoring/speaker_set/*", "{0}"],
  // --- モニタリング: 個別モニター (downmix/mono 等) ---
  ["oem_ui_process_engine/monitoring/monitors/*/downmix/*", "monitor/{0}/{1}"],
  ["oem_ui_process_engine/monitoring/monitors/*/*", "monitor/{0}/{1}"],
  // --- 物理操作: ノブ/ボタン ---
  ["oem_ui_process_engine/remote_hw_event/*", "hw/{0}"],
  ["oem_ui_process_engine/rotary_button/*", "hw/rotary/{0}"],
  // --- 本体状態 ---
  ["state/muted", "muted"],
];

/** フォールバック時に落とす、意味の薄い接頭辞セグメント */
const NOISE_PREFIXES = ["oem_ui_process_engine", "monitoring"];

function matchRule(segments: readonly string[], pattern: string): string[] | null {
  const patternSegments = pattern.split("/");
  if (patternSegments.length !== segments.length) return null;

  const captures: string[] = [];
  for (const [i, expected] of patternSegments.entries()) {
    const actual = segments[i];
    if (actual === undefined) return null;
    if (expected === "*") {
      captures.push(actual);
      continue;
    }
    if (expected !== actual) return null;
  }
  return captures;
}

const applyCaptures = (alias: string, captures: readonly string[]): string =>
  alias.replace(/\{(\d+)\}/g, (whole, index: string) => captures[Number(index)] ?? whole);

/**
 * 正規化済みセグメント列を OSC アドレスへ。
 * エイリアスに一致すれば /mt48/<alias>、しなければ /mt48/raw/<...>。
 */
export function segmentsToAddress(segments: readonly string[]): string {
  if (segments.length === 0) return "/mt48/raw";

  for (const [pattern, alias] of ALIAS_RULES) {
    const captures = matchRule(segments, pattern);
    if (captures) return `/mt48/${applyCaptures(alias, captures)}`;
  }

  // 未知のパス: ノイズ接頭辞だけ落として raw/ 配下へ流す
  let rest = [...segments];
  while (rest.length > 1 && NOISE_PREFIXES.includes(rest[0] as string)) {
    rest = rest.slice(1);
  }
  return `/mt48/raw/${rest.join("/")}`;
}

const toOscArg = (value: number | boolean | string): OscArg => {
  if (typeof value === "boolean") return { type: "integer", value: value ? 1 : 0 };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer", value } : { type: "float", value };
  }
  return { type: "string", value };
};

const isPrimitive = (value: unknown): value is number | boolean | string =>
  typeof value === "number" || typeof value === "boolean" || typeof value === "string";

/**
 * 値を OSC メッセージ列へ再帰展開する。
 * プリミティブのみの配列は 1 メッセージに複数引数としてまとめる。
 */
function flatten(segments: readonly string[], value: unknown, out: OscMessage[]): void {
  if (value === null || value === undefined) return;

  if (isPrimitive(value)) {
    out.push({ address: segmentsToAddress(segments), args: [toOscArg(value)] });
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isPrimitive)) {
      out.push({
        address: segmentsToAddress(segments),
        args: value.map(toOscArg),
      });
      return;
    }
    for (const [index, item] of value.entries()) {
      flatten([...segments, String(index)], item, out);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten([...segments, sanitizeSegment(key.replace(/^_+/, ""))], child, out);
    }
  }
}

/** CometD の 1 通知 ({ path, value }) を OSC メッセージ列へ変換する。 */
export function toOscMessages(path: string | undefined, value: unknown): OscMessage[] {
  const messages: OscMessage[] = [];
  flatten(pathToSegments(path), value, messages);
  return messages;
}
