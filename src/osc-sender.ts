import dgram from "node:dgram";
import { toBuffer } from "osc-min";
import type { Logger } from "./logger.js";
import type { OscMessage } from "./osc-address.js";

/**
 * UDP で OSC を送るだけの薄いラッパ。
 *
 * 旧実装は `osc` パッケージを使っていたが、あれは WebSocket (ws) と serialport を
 * 引きずり込む。本ブリッジは UDP 送信しかしないので、依存ゼロの osc-min +
 * Node 標準の dgram に置き換えた（既知の ws 脆弱性もこれで消える）。
 */
export interface OscSender {
  send: (message: OscMessage) => void;
  close: () => Promise<void>;
}

export function createOscSender(host: string, port: number, logger: Logger): OscSender {
  const socket = dgram.createSocket("udp4");
  socket.on("error", (error) => logger.error("[osc]", error.message));
  socket.unref();

  return {
    send({ address, args }) {
      let packet: Buffer;
      try {
        const view = toBuffer({ address, args });
        packet = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
      } catch (error) {
        logger.error("[osc] エンコード失敗", address, (error as Error).message);
        return;
      }

      socket.send(packet, port, host, (error) => {
        if (error) logger.error("[osc] 送信失敗", address, error.message);
      });
      logger.debug("OSC", address, args.map((arg) => arg.value).join(" "));
    },

    close() {
      return new Promise((resolve) => socket.close(() => resolve()));
    },
  };
}
