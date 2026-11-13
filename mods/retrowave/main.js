// RetroWave in Herdr: paints the frames RetroWave serves on 127.0.0.1 (Herdr output on).
// Each line from RetroWave is one frame: {"v":1,"cols":20,"rows":20,"tiles":[[col,row,"rrggbb",opacity?],...]}
// or {"v":1,"idle":true}. A click sends "next-mode".
//
// `mod.open retrowave` opens it as a kept window (right-click closes it); as a layout
// block it draws in place.
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, openOverlay, closeOverlay, theme } from "herdr";
import net from "net";

const DEFAULT_PORT = 47613;
const RETRY_MS = 3000;
const UNLIT = "#ffffff0a";
// Limits on what a frame may ask for; anything bigger is not from RetroWave.
const MAX_GRID = 64;
const MAX_LINE = 65536;
const HEX = /^[0-9a-f]{6}$/;

// Frames are ASCII JSON, so bytes map straight to characters.
function ascii(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return s;
}

const alpha = (opacity) => Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, "0");

export default class RetroWave extends View {
  init(_props, cx) {
    const p = props() ?? {};
    // Opened by mod.open as a one-off overlay: reopen as a kept window and go.
    if (p.overlay && !p.window) {
      openOverlay({ mod: "retrowave", props: { window: true, port: p.port }, kind: "window",
        key: "retrowave", keep: true, width: 360, height: 150 });
      closeOverlay(p.overlay);
      this.launcher = true;
      return;
    }
    this.overlay = p.window ? p.overlay : null;
    this.port = p.port ?? DEFAULT_PORT;
    this.cols = 20; this.rows = 20;
    this.lit = new Map();     // col * rows + row -> colour
    this.state = "offline";   // offline | live | idle
    this.socket = null;
    cx.spawn(async (cx) => this.run(cx));
  }

  async close() {
    this.closed = true;
    try { this.socket?.close(); } catch {}
  }

  sleep(cx, ms) {
    return new Promise((resolve) => cx.timer.after(ms, () => resolve()));
  }

  async run(cx) {
    while (!this.closed) {
      let socket;
      try {
        socket = await net.connect("127.0.0.1", this.port);
      } catch {
        await this.sleep(cx, RETRY_MS);
        continue;
      }
      this.socket = socket;
      let pending = "";
      try {
        for (;;) {
          const chunk = await socket.read(65536);
          if (chunk === null) break;
          pending += ascii(chunk);
          const end = pending.lastIndexOf("\n");
          if (end >= 0) {
            // Only the newest complete frame matters; older ones in the same read are skipped.
            const latest = pending.slice(pending.lastIndexOf("\n", end - 1) + 1, end);
            pending = pending.slice(end + 1);
            if (this.apply(latest)) cx.notify();
          }
          // A line this long is not a frame: drop the connection rather than buffer it.
          if (pending.length > MAX_LINE) break;
        }
      } catch {}
      try { socket.close(); } catch {}
      this.socket = null;
      this.state = "offline";
      this.lit.clear();
      cx.notify();
      await this.sleep(cx, RETRY_MS);
    }
  }

  apply(line) {
    let frame;
    try { frame = JSON.parse(line); } catch { return false; }
    if (frame?.v !== 1) return false;
    if (frame.idle) { this.lit.clear(); this.state = "idle"; return true; }
    const size = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_GRID;
    if (!size(frame.cols) || !size(frame.rows) || !Array.isArray(frame.tiles)
      || frame.tiles.length > frame.cols * frame.rows) return false;
    this.lit.clear();
    this.state = "live";
    this.cols = frame.cols; this.rows = frame.rows;
    for (const tile of frame.tiles) {
      if (!Array.isArray(tile)) continue;
      const [col, row, hex, opacity] = tile;
      if (!Number.isInteger(col) || col < 0 || col >= this.cols
        || !Number.isInteger(row) || row < 0 || row >= this.rows
        || typeof hex !== "string" || !HEX.test(hex)) continue;
      const fade = typeof opacity === "number" ? alpha(opacity) : "";
      this.lit.set(col * this.rows + row, `#${hex}${fade}`);
    }
    return true;
  }

  render(_cx) {
    if (this.launcher) return div();
    const t = theme();
    const closable = (el) => this.overlay
      ? el.on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); closeOverlay(this.overlay); })
      : el;
    if (this.state === "offline") {
      return closable(div().id("root").size_full().flex().items_center().justify_center()
        .text_size(11).text_color(t.dim).child("RetroWave not running"));
    }
    const column = (col) => v_flex().flex_1().h_full().gap(1).children(
      Array.from({ length: this.rows }, (_, row) =>
        div().flex_1().rounded(1).bg(this.lit.get(col * this.rows + row) ?? UNLIT)));
    return closable(h_flex().id("root").size_full().p(6).gap(2)
      .on_click(() => { this.socket?.write("next-mode\n").catch(() => {}); })
      .children(Array.from({ length: this.cols }, (_, col) => column(col))));
  }
}
