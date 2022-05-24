import * as yaml from "js-yaml"
import json2md, { DataObject } from "json2md"
import {
	ChangeContent,
	ChangeEntry,
	ChangesByModule,
	LEVEL_HIGH,
	LEVEL_LOW,
	ModuleChanges,
	TYPE_CHORE,
	TYPE_FEATURE,
	TYPE_FIX,
} from "./parse"
import { MilestoneVersion } from "./changes"

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
	// ensure the section key has its type list:   { "module": { [typ]: [] } }
	function listOf(typ: string) {
		acc[change.section] = acc[change.section] || ({} as ModuleChanges)
		const mc = acc[change.section]
		mc[typ] = mc[typ] || []
		return mc[typ]
	}

	const cc = new ChangeContent({
		summary: change.summary,
		pull_request: change.pull_request,
		impact: change.impact,
	})

	switch (change.type) {
		case TYPE_FIX:
			listOf("fixes").push(cc)
			break
		case TYPE_FEATURE:
			listOf("features").push(cc)
			break
		case TYPE_CHORE:
			// Noop for yaml
			break
		default:
			throw new Error("invalid type: " + change.type)
	}

	return acc
}

/**
 * @function formatMarkdown returns changes formatted in markdown for PR body
 */
export function formatMarkdown(milestone: string, changes: ChangeEntry[]): string {
	const headerTag = "h1"
	const subheaderTag = "h2"
	const milestoneVersion = new MilestoneVersion(milestone)

	const body: DataObject[] = [
		{ [headerTag]: `Changelog ${milestone}` }, // title
	]

	function add(subheader: string, getLines: (changes: ChangeEntry[]) => string[]) {
		const lines = getLines(changes)
		if (lines.length > 0) {
			body.push({ [subheaderTag]: subheader })
			body.push({ ul: lines })
		}
	}

	add("[MALFORMED]", collectMalformed)
	add("Know before update", collectImpact)
	add("Features", (cs) => collectChanges(cs, TYPE_FEATURE))
	add("Fixes", (cs) => collectChanges(cs, TYPE_FIX))
	add("Chore", (cs) => collectChanges(cs, TYPE_CHORE))

	// Add the last line with the URL of MAJ.MIN changelog.
	body.push({
		p: `See [the CHANGELOG ${milestoneVersion.toMinor()}](../main/CHANGELOG/CHANGELOG-${milestoneVersion.toMinor()}.md) for more details.`,
	})

	return json2md(body)
}

export interface ChangesWithVersion {
	version: string
	changes: ChangeEntry[]
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
