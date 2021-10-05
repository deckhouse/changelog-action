import * as yaml from "js-yaml"
import { Change, ChangesByModule } from "./parse"

export function formatYaml(body: ChangesByModule): string {
	const opts = {
		sortKeys: unknownFirst,
		lineWidth: 100,
		forceQuotes: false,
		quotingType: "'",
	} as yaml.DumpOptions

	return yaml.dump(body, opts)
}

function unknownFirst(a: string, b: string): number {
	if (isUnknown(a) || a < b) return -1
	if (isUnknown(b) || a > b) return 1
	return 0
}

function isUnknown(a: string): boolean {
	return typeof a === "string" && a.toLowerCase() == "unknown"
}

export function formatMarkdown(milestone: string, body: ChangesByModule): string {
	const header = `## Changelog ${milestone}`
	return [header, formatYaml(body)].join("\r\n\r\n")
}
