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
	TYPE_DOCS,
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
		case TYPE_DOCS:
			// Noop for yaml
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

	const body: DataObject[] = [
		{ [headerTag]: `Changelog ${milestone}` }, // title
	]

	function add(subheader: string, getLines: (changes: ChangeEntry[]) => string[]) {
		const lines = [...new Set(getLines(changes))]
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

/** Leading "Backport:" (any case) is ignored when merging duplicate changelog lines. */
const BACKPORT_SUMMARY_PREFIX = /^\s*backport:\s*/i

function normalizeSummaryForMarkdownDedup(summary: string): string {
	return summary.replace(BACKPORT_SUMMARY_PREFIX, "").trim()
}

function isBackportSummary(summary: string): boolean {
	return BACKPORT_SUMMARY_PREFIX.test(summary)
}

/** Same section + normalized summary + impact text → one markdown bullet. */
function markdownChangeDedupKey(c: ChangeEntry): string {
	return `${c.section}\0${normalizeSummaryForMarkdownDedup(c.summary)}\0${c.impact ?? ""}`
}

function pickPreferredChangeEntry(a: ChangeEntry, b: ChangeEntry): ChangeEntry {
	const aBack = isBackportSummary(a.summary)
	const bBack = isBackportSummary(b.summary)
	if (aBack !== bBack) {
		return aBack ? b : a
	}
	const na = parseInt(parsePullNumberFromURL(a.pull_request), 10)
	const nb = parseInt(parsePullNumberFromURL(b.pull_request), 10)
	if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
		return na < nb ? a : b
	}
	return a
}

interface MergedChangeForMarkdown {
	primary: ChangeEntry
	/** Unique PR numbers in this group */
	prNumbers: number[]
	prUrlByNumber: Map<number, string>
}

function dedupeChangesForMarkdown(sorted: ChangeEntry[]): MergedChangeForMarkdown[] {
	const order: string[] = []
	const byKey = new Map<
		string,
		{ primary: ChangeEntry; nums: Set<number>; urls: Map<number, string> }
	>()
	for (const c of sorted) {
		const k = markdownChangeDedupKey(c)
		const n = parseInt(parsePullNumberFromURL(c.pull_request), 10)
		const existing = byKey.get(k)
		if (!existing) {
			order.push(k)
			const urls = new Map<number, string>()
			if (Number.isFinite(n)) {
				urls.set(n, c.pull_request)
			}
			byKey.set(k, {
				primary: c,
				nums: new Set(Number.isFinite(n) ? [n] : []),
				urls,
			})
		} else {
			if (Number.isFinite(n)) {
				existing.nums.add(n)
				existing.urls.set(n, c.pull_request)
			}
			existing.primary = pickPreferredChangeEntry(existing.primary, c)
		}
	}
	return order.map((k) => {
		const { primary, nums, urls } = byKey.get(k)!
		let prNumbers = [...nums]
		if (prNumbers.length === 0) {
			const fallback = parseInt(parsePullNumberFromURL(primary.pull_request), 10)
			if (Number.isFinite(fallback)) {
				prNumbers = [fallback]
				if (!urls.has(fallback)) {
					urls.set(fallback, primary.pull_request)
				}
			}
		}
		return { primary, prNumbers, prUrlByNumber: urls }
	})
}

/** When several PRs match the same line, link the one with the smallest PR number */
function formatChangeMarkdownLine(
	primary: ChangeEntry,
	prNumbers: number[],
	prUrlByNumber: Map<number, string>,
): string {
	let prlink: string
	if (prNumbers.length === 0) {
		const prNum = parsePullNumberFromURL(primary.pull_request)
		prlink = `[#${prNum}](${primary.pull_request})`
	} else {
		const chosen = Math.min(...prNumbers)
		const prUrl = prUrlByNumber.get(chosen) ?? primary.pull_request
		prlink = `[#${chosen}](${prUrl})`
	}
	const line = `**[${primary.section}]** ${primary.summary} ${prlink}`

	if (primary.impact) {
		return line + "\n" + primary.impact
	}
	return line
}

// avoids low impact noise in markdown
function collectChanges(changes: ChangeEntry[], changeType: string): string[] {
	return dedupeChangesForMarkdown(
		changes
			.filter((c) => c.valid() && c.type == changeType && c.impact_level != LEVEL_LOW)
			.sort((a, b) => (a.section < b.section ? -1 : 1)), // sort by module
	).map(({ primary, prNumbers, prUrlByNumber }) =>
		formatChangeMarkdownLine(primary, prNumbers, prUrlByNumber),
	)
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
