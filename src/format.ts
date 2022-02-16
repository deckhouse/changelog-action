import * as yaml from "js-yaml"
import json2md, { DataObject } from "json2md"
import {
	ChangeContent,
	ChangeEntry,
	ChangesByModule,
	LEVEL_HIGH,
	LEVEL_LOW,
	ModuleChanges,
	TYPE_FEATURE,
	TYPE_FIX,
} from "./parse"

// sorts YAML keys
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
		case TYPE_FIX:
			list = getTypeList("fixes")
			break
		case TYPE_FEATURE:
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

/**
 * @function formatMarkdown returns changes formatted in markdown for PR body
 */
export function formatMarkdown(milestone: string, changes: ChangeEntry[]): string {
	const headerTag = "h1"
	const subheaderTag = "h2"

	const body: DataObject[] = [
		{ [headerTag]: `Changelog ${milestone}` }, // title
	]

	const malformed = collectMalformed(changes)
	if (malformed.length > 0) {
		body.push({ [subheaderTag]: "[MALFORMED]" })
		body.push({ ul: malformed })
	}

	const impacts = collectImpact(changes)
	if (impacts.length > 0) {
		body.push({ [subheaderTag]: "Release digest" })
		body.push({ ul: impacts })
	}

	const features = collectChanges(changes, TYPE_FEATURE)
	if (features.length > 0) {
		body.push({ [subheaderTag]: "Features" })
		body.push({ ul: features })
	}

	const fixes = collectChanges(changes, TYPE_FIX)
	if (fixes.length > 0) {
		body.push({ [subheaderTag]: "Fixes" })
		body.push({ ul: fixes })
	}

	return json2md(body)
}

export interface ChangesWithVersion {
	version: string
	changes: ChangeEntry[]
}

/**
 * @function formatCumulatieMarkdown returns cumulative changelog in markdown
 */
export function formatCumulatieMarkdown(minorVersion: string, cwvs: ChangesWithVersion[]): string {
	const headerTag = "h1"
	const subheaderTag = "h2"

	const body: DataObject[] = [{ [headerTag]: `Changelog ${minorVersion}` }]

	for (const x of cwvs) {
		body.push({ [subheaderTag]: x.version })
		body.push(...collectPartialMarkdown(x.changes))
	}

	return json2md(body)
}

/**
 * @function formatPartialMarkdown returns partial changes formatted in markdown for accumulating in
 * single file
 */
function collectPartialMarkdown(changes: ChangeEntry[]): DataObject[] {
	const subheaderTag = "h3"

	const body: DataObject[] = []

	const features = collectChanges(changes, TYPE_FEATURE)
	if (features.length > 0) {
		body.push({ [subheaderTag]: "Features" })
		body.push({ ul: features })
	}

	const fixes = collectChanges(changes, TYPE_FIX)
	if (fixes.length > 0) {
		body.push({ [subheaderTag]: "Fixes" })
		body.push({ ul: fixes })
	}

	return body
}

function collectImpact(changes: ChangeEntry[]): string[] {
	return changes
		.filter((c) => c.valid() && c.impact_level === LEVEL_HIGH)
		.map((c) => c.impact)
		.filter((x): x is string => !!x) // for type check calmness
		.sort() // sorting to naіvely group potentially similar impacts together
}

// avoids low impact noise in markdown
function collectChanges(changes: ChangeEntry[], changeType: string): string[] {
	return changes
		.filter((c) => c.valid() && c.type == changeType && c.impact_level != LEVEL_LOW)
		.sort((a, b) => (a.section < b.section ? -1 : 1)) // sort by module
		.map(changeMardown)
}

function collectMalformed(changes: ChangeEntry[]): string[] {
	return changes
		.filter((c) => !c.valid()) // malformed
		.map((c) => ({
			pr: parseInt(parsePullNumberFromURL(c.pull_request), 10),
			message: c.validate().join(", "),
		}))
		.sort((a, b) => a.pr - b.pr) // asc
		.map((c) => `#${c.pr} ${c.message}`) // Github expands "#123" to PR links
}

function parsePullNumberFromURL(prUrl: string): string {
	const parts = prUrl.split("/")
	return parts[parts.length - 1]
}

function changeMardown(c: ChangeEntry): string {
	const prNum = parsePullNumberFromURL(c.pull_request)

	const prlink = `[#${prNum}](${c.pull_request})`
	const line = `**[${c.section}]** ${c.summary} ${prlink}`

	if (c.impact) {
		return line + "\n" + c.impact
	}
	return line
}
