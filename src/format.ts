import * as yaml from "js-yaml"
import { Change, ModuleChanges, ChangesByModule } from "./parse"
import json2md, { DataObject } from "json2md"

const MARKDOWN_HEADER_TAG = "h2"
const MARKDOWN_MODULER_TAG = "h4"
const MARKDOWN_NOTE_PREFIX = "**NOTE!**"

/**
 * @function formatYaml returns changes formatted in YAML
 * @param changes by module
 * @returns
 */
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

function isUnknown(s: string): boolean {
	return typeof s === "string" && s.toLowerCase() === "unknown"
}

/**
 * @function formatMarkdown returns changes formatted in markdown
 * @param changes by module
 * @returns
 */
export function formatMarkdown(milestone: string, body: ChangesByModule): string {
	const pairs = Object.entries(body).sort((a, b) => unknownFirst(a[0], b[0]))

	const content: DataObject = [{ [MARKDOWN_HEADER_TAG]: `Changelog ${milestone}` }]
	for (const [modnName, changes] of pairs) {
		content.push({ [MARKDOWN_MODULER_TAG]: `[${modnName}]` })
		content.push({ ul: moduleChangesMarkdown(changes) })
	}

	const md = json2md(content)

	// Workaround to omit excessive empty lines
	// https://github.com/IonicaBizau/json2md/issues/53
	return fixLineBreaks(md)
}

function fixLineBreaks(md: string): string {
	const fixed = md
		.split("\n")
		.filter((s) => s.trim() != "")
		.map((s) => (s.startsWith("###") ? `\n${s}\n` : s))
		.join("\n")
	return fixed + "\n"
}

function moduleChangesMarkdown(mc: ModuleChanges) {
	const md: DataObject = []
	if (mc.unknown) {
		md.push("unknown")
		md.push({ ul: mc.unknown.flatMap(changeMardown) })
	}
	if (mc.features) {
		md.push("features")
		md.push({ ul: mc.features.flatMap(changeMardown) })
	}
	if (mc.fixes) {
		md.push("fixes")
		md.push({ ul: mc.fixes.flatMap(changeMardown) })
	}
	// console.log("mc", JSON.stringify(md, null, 2))
	return md
}

function changeMardown(c: Change): DataObject {
	const detail: unknown[] = [{ link: { source: c.pull_request, title: "Pull request" } }]
	if (c.note) {
		detail.push(`${MARKDOWN_NOTE_PREFIX} ${c.note}`)
	}

	return [c.description, { ul: detail }]
}
