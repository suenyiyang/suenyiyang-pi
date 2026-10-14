import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import spacexai from "../node_modules/pi-spacexai/index.ts";

const SKIPPED_TOOLS = new Set(["web_search"]);

// Upstream pi-spacexai also registers web_search. This preset keeps that name
// for pi-web-access and still loads the image, video, X, and voice tools.
export default function spacexaiMedia(pi: ExtensionAPI) {
	const registerTool = pi.registerTool.bind(pi);
	pi.registerTool = ((tool) => {
		if (SKIPPED_TOOLS.has(tool.name)) return;
		return registerTool(tool);
	}) as ExtensionAPI["registerTool"];
	return spacexai(pi);
}
