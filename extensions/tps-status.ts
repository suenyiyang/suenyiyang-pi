/**
 * TPS Status — 在 footer 实时显示 tokens/second（流式生成速率）。
 *
 * 原理：
 * - 监听 `message_update` 的逐 token 流事件（text/thinking/toolcall delta），
 *   累加估算 token 数（CJK 字符 ≈ 1 token，其余 ≈ 4 字符/token）。
 * - 每 100ms 节流一次 `ctx.ui.setStatus()` 更新 footer（避免每 token 全量重渲染）。
 * - 流结束时用 provider 返回的精确 usage.output 校准，显示最终平均速率。
 *
 * 命令：/tps 切换显示开关。
 */

import { appendFileSync } from "node:fs";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "tps";
const THROTTLE_MS = 100;

/** 调试：设置 TPS_DEBUG_LOG 环境变量时记录事件流（正常使用无开销） */
const DEBUG_LOG = process.env.TPS_DEBUG_LOG;
function dbg(msg: string) {
	if (!DEBUG_LOG) return;
	try {
		appendFileSync(DEBUG_LOG, `${Date.now()} ${msg}\n`);
	} catch {
		/* ignore */
	}
}

/** 粗略估算 token 数：CJK/全角字符 ≈ 1 token，其余 ≈ 4 字符/token */
function estimateTokens(text: string): number {
	let tokens = 0;
	for (const ch of text) {
		tokens += /[\u2e80-\u9fff\u3040-\u30ff\uac00-\ud7af\uff00-\uffef]/.test(ch) ? 1 : 0.25;
	}
	return tokens;
}

function formatTps(tps: number): string {
	return tps >= 10 ? tps.toFixed(0) : tps.toFixed(1);
}

export default function (pi: ExtensionAPI) {
	let enabled = true;

	let streaming = false;
	let startTime = 0;
	let tokens = 0; // 本次流式累计的估算 token 数
	let lastUpdate = 0;

	function currentTps(): number {
		const elapsed = (Date.now() - startTime) / 1000;
		return elapsed > 0.5 ? tokens / elapsed : 0;
	}

	function setStatus(ui: ExtensionContext["ui"], text: string | undefined) {
		// 用当前主题的 dim 灰色，和 footer 里预置的 token/cache/模型名保持一致
		ui.setStatus(STATUS_KEY, text === undefined ? undefined : ui.theme.fg("dim", text));
	}

	pi.on("message_start", async (event, ctx) => {
		if (!enabled || event.message.role !== "assistant") return;
		streaming = true;
		startTime = Date.now();
		tokens = 0;
		lastUpdate = 0;
		dbg(`message_start: streaming start`);
		setStatus(ctx.ui, `↓ ${formatTps(0)} tok/s`);
	});

	pi.on("message_update", async (event, ctx) => {
		if (!enabled) return;
		const ev = event.assistantMessageEvent;

		// 注意：message_update 只携带 delta 类事件（start 走的是 message_start）
		if (ev.type === "text_delta" || ev.type === "thinking_delta" || ev.type === "toolcall_delta") {
			tokens += estimateTokens(ev.delta);
			dbg(`delta ${ev.type} +=${estimateTokens(ev.delta).toFixed(2)} tokens=${tokens.toFixed(1)}`);
			if (!streaming) return;
			const now = Date.now();
			if (now - lastUpdate < THROTTLE_MS) return; // 节流，避免每 token 都重渲染
			lastUpdate = now;
			dbg(`status update: tps=${currentTps().toFixed(2)}`);
			setStatus(ctx.ui, `↓ ${formatTps(currentTps())} tok/s`);
		}
	});

	pi.on("message_end", async (event, ctx) => {
		if (event.message.role !== "assistant" || !enabled) return;
		streaming = false;

		const elapsed = (Date.now() - startTime) / 1000;
		if (elapsed <= 0) return;

		// 优先用 provider 的精确 token 数校准；拿不到就用估算值
		const m = event.message as AssistantMessage;
		const exact = m.usage?.output ?? 0;
		const tps = (exact > 0 ? exact : tokens) / elapsed;
		dbg(`message_end: exact=${exact} est=${tokens.toFixed(1)} elapsed=${elapsed.toFixed(2)}s tps=${tps.toFixed(2)}`);
		setStatus(ctx.ui, `↓ ${formatTps(tps)} tok/s`);
	});

	pi.registerCommand("tps", {
		description: "Toggle real-time tokens/sec display in the footer",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) {
				ctx.ui.notify("TPS display enabled", "info");
			} else {
				ctx.ui.setStatus(STATUS_KEY, undefined);
				ctx.ui.notify("TPS display disabled", "info");
			}
		},
	});
}
