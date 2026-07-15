import dgram from "node:dgram";
import { fromBuffer } from "osc-min";
import { config, log } from "./env.js";
import type { OscArg } from "./osc-address.js";

/**
 * UDP で OSC を受信し、1 メッセージずつコールバックへ渡す薄いラッパ。
 *
 * 送信側 (osc-sender) と対になる受信口。Max からの制御 OSC を待ち受ける。
 * bundle が来た場合は展開して各メッセージを個別に渡す。
 */
export interface OscReceiver {
  close: () => Promise<void>;
}

type Decoded = ReturnType<typeof fromBuffer>;

export function createOscReceiver(
  onMessage: (address: string, args: readonly OscArg[]) => void,
): OscReceiver {
  const socket = dgram.createSocket("udp4");
  socket.on("error", (error) => log.error("[osc-in]", error.message));

  const dispatch = (packet: Decoded): void => {
    if (packet.oscType === "bundle") {
      for (const element of packet.elements) dispatch(element);
      return;
    }
    onMessage(packet.address, packet.args as readonly OscArg[]);
  };

  socket.on("message", (buffer) => {
    let packet: Decoded;
    try {
      packet = fromBuffer(buffer);
    } catch (error) {
      log.warn("[osc-in] デコード失敗", (error as Error).message);
      return;
    }
    dispatch(packet);
  });

  socket.bind(config.oscInPort, config.oscInHost, () => {
    log.info(`OSC in: listening ${config.oscInHost}:${config.oscInPort}`);
  });

  return {
    close() {
      return new Promise((resolve) => socket.close(() => resolve()));
    },
  };
}
