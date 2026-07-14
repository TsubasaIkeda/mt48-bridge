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
 * 実機で観測した id とボタンの対応。
 * id はファームウェア側で固定されており、ラベル(text)とアイコン(image_url)から同定した。
 */
const BUTTON_NAMES: Record<number, string> = {
  1: "speaker_a", //  text "A" + Neumann_Speaker
  2: "speaker_b", //  text "B" + Neumann_Speaker
  3: "phones_1", //   text "1" + Neumann_Headphone
  4: "phones_2", //   text "2" + Neumann_Headphone
  101: "phones_3", // text "3" + Neumann_HeadphoneVK (仮想キー)
};

/** 未知の id は key_<id> で流す。取りこぼすよりマシで、後から名前を足せる。 */
export const buttonName = (id: number): string => BUTTON_NAMES[id] ?? `key_${id}`;

/**
 * 各ボタンの「消灯時の色」。実機で観測した値。
 *
 * 点灯色はボタンごとに違う（speaker_b は橙 #ff3f00、phones_1 は緑 #10d708 …）が、
 * 消灯色はボタンごとに一定なので、これと比較して点灯/消灯を 0/1 で出せる。
 * 一覧に無い id は点灯判定ができないため、色だけを送る。
 */
const OFF_COLORS: Record<number, string> = {
  1: "#1a1a1a", //   speaker_a
  2: "#1a1a1a", //   speaker_b
  3: "#1a1a1a", //   phones_1
  4: "#1a1a1a", //   phones_2
  6: "#0d0d0d", //   key_6
  101: "#a0a0a0", // phones_3
};

export interface ButtonTracker {
  /** triggers 配列を受け取り、前回から色が変わったボタンぶんの OSC を返す。 */
  update: (triggers: readonly Trigger[]) => OscMessage[];
}

export function createButtonTracker(): ButtonTracker {
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
      for (const [id, color] of current) {
        const before = previous.get(id);
        if (before === undefined || before === color) continue;

        const name = buttonName(id);
        const offColor = OFF_COLORS[id];
        if (offColor !== undefined) {
          messages.push({
            address: `/mt48/button/${name}`,
            args: [{ type: "integer", value: color === offColor ? 0 : 1 }],
          });
        }
        messages.push({
          address: `/mt48/button/${name}/color`,
          args: [{ type: "string", value: color }],
        });
      }

      previous = current;
      return messages;
    },
  };
}
