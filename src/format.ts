import * as yaml from "js-yaml"
import json2md, { DataObject } from "json2md"
import { Change, ChangeEntry, ChangesByModule, ModuleChanges } from "./parse"

/**
 * @function formatYaml returns changes formatted in YAML with grouping by module, type, and omiiting invalid entries
 * @param changes by module
 * @returns
 */
export function formatYaml(changes: ChangeEntry[]): string {
	const opts = {
		sortKeys: true,
		lineWidth: 100,
		forceQuotes: false,
		quotingType: "'",
	} as yaml.DumpOptions

	// create the map from only valid entries:  module -> fix/feature -> change[]
	const body = changes
		.filter((c) => c.valid()) //
		.reduce(groupByModuleAndType, {})

	return yaml.dump(body, opts)
}

function groupByModuleAndType(acc: ChangesByModule, change: ChangeEntry) {
	// ensure module key:   { "module": {} }
	acc[change.module] = acc[change.module] || ({} as ModuleChanges)
	const mc = acc[change.module]
	const getTypeList = (k: string) => {
		mc[k] = mc[k] || []
		return mc[k]
	}

	// ensure module change list
	// e.g. for fixes: { "module": { "fixes": [] } }
	let list
	switch (change.type) {
		case "fix":
			list = getTypeList("fixes")
			break
		case "feature":
			list = getTypeList("features")
			break
		default:
			throw new Error("invalid type")
	}

	// add the change
	list.push(
		new Change({
			description: change.description,
			pull_request: change.pull_request,
			note: change.note,
		}),
	)

	return acc
}

const MARKDOWN_HEADER_TAG = "h2"
const MARKDOWN_MODULE_TAG = "h4"
const MARKDOWN_NOTE_PREFIX = "**NOTE!**"

/**
 * @function formatMarkdown returns changes formatted in markdown
 * @param changes by module
 * @returns
 */
export function formatMarkdown(milestone: string, changes: ChangeEntry[]): string {
	const body: DataObject[] = [
		{ [MARKDOWN_HEADER_TAG]: `Changelog ${milestone}` }, // title
		...formatMalformedEntries(changes),
		...formatEntriesByModuleAndType(changes),
	]

	const md = json2md(body)

	// Workaround to omit excessive empty lines
	// https://github.com/IonicaBizau/json2md/issues/53
	return fixLineBreaks(md)
}

function fixLineBreaks(md: string): string {
	const fixed = md
		.split("\n")
		// remove empty lines
		.filter((s) => s.trim() != "")
		// wrap subheaders with empty lines
		.map((s) => (s.startsWith("###") ? `\n${s}\n` : s))
		.map((s) => (s.startsWith("**") && s.endsWith("**") ? `\n${s}\n` : s))
		.join("\n")

	// add empty line to the end
	return fixed + "\n"
}

function formatEntriesByModuleAndType(changes: ChangeEntry[]): DataObject[] {
	const body: DataObject[] = []

	const validEntries = changes
		.filter((c) => c.valid()) //
		.reduce(groupByModuleAndType, {})

	// Collect valid change entries; sort by module name
	const pairs = Object.entries(validEntries).sort((a, b) => (a[0] < b[0] ? -1 : 1))
	for (const [modName, changes] of pairs) {
		body.push({ [MARKDOWN_MODULE_TAG]: modName })
		body.push(...moduleChangesMarkdown(changes))
	}

	return body
}

function formatMalformedEntries(changes: ChangeEntry[]): DataObject[] {
	const body: DataObject[] = []

	// Collect malformed on the top for easier fixing
	const invalidEntries = changes
		.filter((c) => !c.valid())
		.sort((a, b) => (a.pull_request < b.pull_request ? -1 : 1))

	if (invalidEntries.length > 0) {
		body.push([{ [MARKDOWN_MODULE_TAG]: "[MALFORMED]" }])

		const ul: string[] = []
		for (const c of invalidEntries) {
			const prNum = parsePullRequestNumberFromURL(c.pull_request)
			ul.push(`[#${prNum}](${c.pull_request})`)
		}
		body.push({ ul: ul.sort() })
	}

	return body
}

function moduleChangesMarkdown(moduleChanges: ModuleChanges): DataObject[] {
	const md: DataObject[] = []
	if (moduleChanges.features) {
		md.push({ p: "**features**" })
		md.push({ ul: moduleChanges.features.flatMap(changeMardown) })
	}
	if (moduleChanges.fixes) {
		md.push({ p: "**fixes**" })
		md.push({ ul: moduleChanges.fixes.flatMap(changeMardown) })
	}
	// console.log("mc", JSON.stringify(md, null, 2))
	return md
}

function parsePullRequestNumberFromURL(prUrl: string): string {
	const parts = prUrl.split("/")
	return parts[parts.length - 1]
}

function changeMardown(c: Change): string {
	const pr = parsePullRequestNumberFromURL(c.pull_request)
	const lines = [`${c.description} [#${pr}](${pr})`]

	if (c.note) {
		lines.push(`${MARKDOWN_NOTE_PREFIX} ${c.note}`)
	}

	return lines.join("\n")
}
