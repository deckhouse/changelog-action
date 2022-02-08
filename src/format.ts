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
			throw new Error("invalid type: " + change.type)
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

const MARKDOWN_HEADER_TAG = "h1"
const MARKDOWN_TYPE_TAG = "h2"
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
		...formatFeatureEntries(changes),
		...formatFixEntries(changes),
	]

	const md = json2md(body)

	// Workaround to omit excessive empty lines
	// https://github.com/IonicaBizau/json2md/issues/53
	// return fixLineBreaks(md)
	console.log(md)
	return md
}

function formatFeatureEntries(changes: ChangeEntry[]): DataObject[] {
	return formatEntries(changes, "feature", "Features")
}

function formatFixEntries(changes: ChangeEntry[]): DataObject[] {
	return formatEntries(changes, "fix", "Fixes")
}

function formatEntries(changes: ChangeEntry[], changeType: string, subHeader: string): DataObject[] {
	const filtered = changes
		.filter((c) => c.valid() && c.type == changeType) //
		.sort((a, b) => (a.module < b.module ? -1 : 1)) // sort by module

	const body: DataObject[] = []
	if (filtered.length === 0) {
		return body
	}

	body.push({ [MARKDOWN_TYPE_TAG]: subHeader })
	body.push({ ul: filtered.map(changeMardown) })

	return body
}

function formatMalformedEntries(changes: ChangeEntry[]): DataObject[] {
	const body: DataObject[] = []

	// Collect malformed on the top for easier fixing
	const malformed = changes
		.filter((c) => !c.valid())
		.sort((a, b) => (a.pull_request < b.pull_request ? -1 : 1))

	if (malformed.length > 0) {
		body.push([{ [MARKDOWN_TYPE_TAG]: "[MALFORMED]" }])

		const ul: string[] = []
		for (const c of malformed) {
			const prNum = parsePullRequestNumberFromURL(c.pull_request)
			ul.push(`[#${prNum}](${c.pull_request})`)
		}
		body.push({ ul: ul.sort() })
	}

	return body
}

function parsePullRequestNumberFromURL(prUrl: string): string {
	const parts = prUrl.split("/")
	return parts[parts.length - 1]
}

function changeMardown(c: ChangeEntry): string {
	const pr = parsePullRequestNumberFromURL(c.pull_request)
	const lines = [`**[${c.module}]** ${c.description} [#${pr}](${pr})`]

	if (c.note) {
		lines.push(`${MARKDOWN_NOTE_PREFIX} ${c.note}`)
	}

	return lines.join("\n")
}

function fixLineBreaks(md: string): string {
	const fixed = md
		.split("\n")
		// remove empty lines
		.filter((s) => s.trim() != "")
		// wrap subheaders with empty lines
		.map((s) => (s.startsWith("#") ? `${s}\n` : s))
		.join("\n")

	// add empty line to the end
	return fixed + "\n"
}
