import * as yaml from "js-yaml"
import json2md, { DataObject } from "json2md"
import { ChangeContent, ChangeEntry, ChangesByModule, ModuleChanges } from "./parse"

function getYAMLSorter() {
	// don't pollute the scope with globals
	const yamlFieldSorter = {
		features: 1,
		fixes: 2,

		summary: 1,
		pull_request: 2,
		impact: 3,
	}
	return function sort(a: string, b: string): number {
		if (a in yamlFieldSorter && b in yamlFieldSorter) {
			return yamlFieldSorter[a] - yamlFieldSorter[b]
		}
		return a < b ? -1 : 1
	}
}

/**
 * @function formatYaml returns changes formatted in YAML with grouping by module, type, and
 * omitting invalid entries
 * @param changes by module
 * @returns
 */
export function formatYaml(changes: ChangeEntry[]): string {
	const opts = {
		sortKeys: getYAMLSorter(),
		lineWidth: 100,
		forceQuotes: false,
		quotingType: "'",
	} as yaml.DumpOptions

	// create the map from only valid entries:  module -> fix/feature -> change[]
	const body = changes
		.filter((c) => c.valid()) //
		.filter((c) => c.level !== "low")
		.reduce(groupByModuleAndType, {})

	return yaml.dump(body, opts)
}

function groupByModuleAndType(acc: ChangesByModule, change: ChangeEntry) {
	// ensure module key:   { "module": {} }
	acc[change.section] = acc[change.section] || ({} as ModuleChanges)
	const mc = acc[change.section]
	const getTypeList = (k: string) => {
		mc[k] = mc[k] || []
		return mc[k]
	}

	// ensure module change list
	// e.g. for fixes: { "module": { "fixes": [] } }
	let list: ChangeContent[]
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
		new ChangeContent({
			summary: change.summary,
			pull_request: change.pull_request,
			impact: change.impact,
		}),
	)

	return acc
}

const MARKDOWN_HEADER_TAG = "h1"
const MARKDOWN_TYPE_TAG = "h2"

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

	return json2md(body)
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
		.sort((a, b) => (a.section < b.section ? -1 : 1)) // sort by module

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
		.map((c) => ({
			pr: parseInt(parsePullRequestNumberFromURL(c.pull_request), 10),
			message: c.validate().join(", "),
		}))
		.sort((a, b) => a.pr - b.pr)

	if (malformed.length > 0) {
		body.push([{ [MARKDOWN_TYPE_TAG]: "[MALFORMED]" }])

		const ul: string[] = []
		for (const m of malformed) {
			ul.push(`#${m.pr} ${m.message}`)
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
	const prNum = parsePullRequestNumberFromURL(c.pull_request)
	const lines = [`**[${c.section}]** ${c.summary} [#${prNum}](${c.pull_request})`]

	if (c.impact) lines.push(c.impact)

	return lines.join("\n")
}
