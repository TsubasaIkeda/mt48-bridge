import type { OscMessage } from "./osc-address.js";

/**
 * フロントパネルのボタン。
 *
 * MT48 は「ボタンが押された」というイベントを送ってこない。送ってくるのは
 * `remote_hw_event.triggers` = 各ボタンの LED 状態（id / ラベル / 背景色）の配列で、
 * ボタンを押すと該当ボタンの background_color が変わる。
 * したがって「どのボタンを押したか」は、前回状態との差分でしか取れない。
 *
 * triggers は全ボタン分がまとめて毎回届くので、そのまま流すと Max 側で
 * 差分を取る羽目になる。ここで差分を取り、変化したボタンだけを送る。
 *
 * アドレスはボタン ID をそのまま使う（/mt48/button/1）。ボタンはモニターと
 * 1 対 1 で対応しており（monitors[].button_id）、その名前 (Stereo, Phone1 ...)
 * は MT48 側でユーザーが変更できる。名前をソースに焼き込むと実機とズレるので、
 * 名前は起動時に引いて /mt48/button/<id>/name で併せて送る。
 *
 * 加えて、最後に状態が変わったボタンの ID を /mt48/button/last で 1 つ出す。
 */

export interface Trigger {
  id: number;
  enabled?: boolean;
  background_color?: string;
  blink?: boolean;
  text?: string;
  image_url?: string;
}

/**
 * 各ボタンの「消灯時の色」。実機で観測した値。
 *
 * 点灯色はボタンごとに違う（Atmos は橙 #ff3f00、Phone1 は緑 #10d708 …）が、
 * 消灯色はボタンごとに一定なので、これと比較して点灯/消灯を 0/1 で出せる。
 * 一覧に無い id は点灯判定ができないため、色だけを送る。
 */
const OFF_COLORS: Record<number, string> = {
  1: "#1a1a1a", //   モニター (Stereo)
  2: "#1a1a1a", //   モニター (Atmos)
  3: "#1a1a1a", //   モニター (Phone1)
  4: "#1a1a1a", //   モニター (Phone2)
  6: "#0d0d0d", //   用途不明
  101: "#a0a0a0", // モニター (Phone3) — 仮想キー
  102: "#a0a0a0", // モニター (Phone4) — 仮想キー
  103: "#a0a0a0", // モニター (Phone5) — 仮想キー
  104: "#a0a0a0", // モニター (Phone6) — 仮想キー
};

export interface ButtonTracker {
  /** triggers 配列を受け取り、前回から色が変わったボタンぶんの OSC を返す。 */
  update: (triggers: readonly Trigger[]) => OscMessage[];
}

/** モニター名が Phone（ヘッドフォン）かどうか。device-api の判定と揃える。 */
const isPhoneName = (name: string): boolean => /^phone\s*\d+$/i.test(name.trim());

/**
 * 現在点灯しているスピーカー（Phone 以外の名前付きモニター）ボタンの ID を返す。
 * 複数あれば最初に見つかったもの。無ければ undefined。
 */
function findLitSpeaker(
  current: ReadonlyMap<number, string>,
  names: ReadonlyMap<number, string>,
): number | undefined {
  for (const [id, color] of current) {
    const name = names.get(id);
    if (name === undefined || isPhoneName(name)) continue;
    const offColor = OFF_COLORS[id];
    if (offColor !== undefined && color !== offColor) return id;
  }
  return undefined;
}

/**
 * @param names ボタン ID -> 名前（monitors[].button_id -> monitors[].name）。
 *              引けなかった ID は名前を送らない。
 */
export function createButtonTracker(names: ReadonlyMap<number, string>): ButtonTracker {
  let previous: Map<number, string> | null = null;

  return {
    update(triggers) {
      const current = new Map<number, string>();
      for (const trigger of triggers) {
        current.set(trigger.id, trigger.background_color ?? "");
      }

      // 最初の1回は差分の基準を作るだけ。ここで送ると、接続しただけで
      // 全ボタンを押したかのような OSC が飛んでしまう。
      if (previous === null) {
        previous = current;
        return [];
      }

      const messages: OscMessage[] = [];
      // 「最後に状態が変わったボタン」。同時に複数変わる（モニター切替で押した方が ON、
      // 前の選択が OFF）場合は、点灯した方＝ユーザーが操作したボタンを優先する。
      // 対象はモニターに対応する（名前のある）ボタンだけ。Speaker B (id=6) のような
      // 名無しボタンは、スピーカー切り替え等で変化しても last には出さない。
      let lastChanged: number | undefined;
      let lastActivated: number | undefined;
      let phoneTurnedOff = false;

      for (const [id, color] of current) {
        const before = previous.get(id);
        if (before === undefined || before === color) continue;

        const name = names.get(id);

        const offColor = OFF_COLORS[id];
        if (offColor !== undefined) {
          const on = color !== offColor;
          messages.push({
            address: `/mt48/button/${id}`,
            args: [{ type: "integer", value: on ? 1 : 0 }],
          });
          if (name !== undefined) {
            if (on) lastActivated = id;
            else if (isPhoneName(name)) phoneTurnedOff = true;
          }
        }

        if (name !== undefined) {
          messages.push({
            address: `/mt48/button/${id}/name`,
            args: [{ type: "string", value: name }],
          });
        }

        messages.push({
          address: `/mt48/button/${id}/color`,
          args: [{ type: "string", value: color }],
        });

        if (name !== undefined) lastChanged = id;
      }

      // ヘッドフォン(Phone)が消灯し、かつ何も点灯しなかったときは、点灯している
      // スピーカーを last にする（ヘッドフォンを外してスピーカー監視へ戻ったことを表す）。
      let last = lastActivated ?? lastChanged;
      if (phoneTurnedOff && lastActivated === undefined) {
        const litSpeaker = findLitSpeaker(current, names);
        if (litSpeaker !== undefined) last = litSpeaker;
      }

      if (last !== undefined) {
        messages.push({ address: "/mt48/button/last", args: [{ type: "integer", value: last }] });
      }

      previous = current;
      return messages;
    },
  };
}
