import * as yaml from "js-yaml"

export interface PullRequest {
	state: string
	number: number
	url: string
	title: string
	body: string
	milestone: {
		title: string
		number: number
	}
}

export interface ChangesByModule {
	[module: string]: ModuleChanges
}
/**
 * ModuleChanges describes changes in single module grouped by type
 */
export interface ModuleChanges {
	fixes?: Change[]
	features?: Change[]
	unknown?: Change[]
}

export function collectChangelog(pulls: PullRequest[]): ChangesByModule {
	return pulls
		.map((pr) => ({ pr, changesText: extractChanges(pr.body) }))
		.flatMap(({ pr, changesText }) => parseChangeEntries(pr, changesText))
		.reduce(groupByModule, {})
}

/**
 * changesText example:
 *
 *   module: module3
 *   type: fix
 *   description: what was fixed in 151
 *   note: Network flap is expected, but no longer than 10 seconds
 *   ---
 *   module: module3
 *   type: feature
 *   description: added big thing to enhance security
 *
 */
export function parseChangeEntries(pr: PullRequest, changesText: string): ChangeEntry[] {
	return yaml //
		.loadAll(changesText)
		.map((doc) => convChange(doc as Partial<ChangeEntryOpts>, pr))
}

const knownTypes = new Set(["fix", "feature"])

/**
 *
 * doc is an object with YAML doc, e.g.
 *
 * {
 *   "module": "module3",
 *   "type": "fix",
 *   "description": "what was fixed in 151",
 *   "note": "Network flap is expected, but no longer than 10 seconds",
 * }
 */
function convChange(doc: Partial<ChangeEntryOpts>, pr: PullRequest): ChangeEntry {
	const fallback = fallbackConvChange(pr)

	const module = sanitizeString(doc.module) || fallback.module
	const description = sanitizeString(doc.description) || fallback.description
	const type = doc.type && knownTypes.has(doc.type) ? doc.type : fallback.type

	const opts: ChangeEntryOpts = {
		module,
		type,
		description,
		pull_request: pr.url,
	}

	const note = doc.note?.trim()
	if (note) {
		opts.note = note
	}

	return new ChangeEntry(opts)
}

function sanitizeString(x: unknown): string {
	if (typeof x === "string" && x.length > 0) {
		return x.trim()
	}

	if (Number.isFinite(x) || x) {
		// not null, undefined, or empty string
		return `${x}`
	}

	return ""
}

const CHANGE_TYPE_UNKNOWN = "unknown"
const MODULE_UNKNOWN = "UNKNOWN"

function fallbackConvChange(pr: PullRequest): ChangeEntry {
	return new ChangeEntry({
		module: MODULE_UNKNOWN,
		type: CHANGE_TYPE_UNKNOWN,
		description: `${pr.title}`.trim() || `${pr.number} (description missing)`,
		pull_request: pr.url,
	})
}

// extractChangesBlock parses only first changes block it meets
export function extractChanges(body: string): string {
	const delim = "```"
	const start = new RegExp(`^${delim}changes\\s*$`, "m")
	const end = new RegExp(`^${delim}\\s*$`, "m")

	// Remove return caret chars to work woth newlines
	const [, ...contents] = body.replace(/\r/g, "").split(start)
	if (contents.length == 0) {
		return ""
	}

	return contents
		.filter((c) => end.test(c)) //  filter by end presence
		.map((c) => c.split(end)[0]) // pick block content
		.filter((x) => !!x) //          avoid undefined
		.map((s) => s.trim()) //        detect empty content
		.filter((x) => !!x) //          avoid empty content
		.join("\n---\n") //             join YAML docs
}

/**
 *  Change is the change entry to be included in changelog
 */
export class Change {
	description = ""
	pull_request = ""
	note?: string

	constructor(o: ChangeOpts) {
		this.description = o.description
		this.pull_request = o.pull_request
		if (o.note) {
			this.note = o.note
		}
	}

	// All required fields should be filled
	valid(): boolean {
		return !!this.description && !!this.pull_request
	}
}
interface ChangeOpts {
	description: string
	pull_request: string
	note?: string
}
/**
 *  PullRequestChange is the change we expect to find in pull request
 */

export class ChangeEntry extends Change {
	module = ""
	type = ""

	constructor(o: ChangeEntryOpts) {
		super(o)
		this.module = o.module
		this.type = o.type
	}

	// All required fields should be filled
	valid(): boolean {
		return !!this.module && !!this.type && super.valid()
	}
}
interface ChangeEntryOpts extends ChangeOpts {
	module: string
	type: string
}

function groupByModule(acc: ChangesByModule, change: ChangeEntry) {
	// ensure module key:   { "module": {} }
	acc[change.module] = acc[change.module] || ({} as ModuleChanges)
	const mc = acc[change.module]
	const ensure = (k: string) => {
		mc[k] = mc[k] || []
		return mc[k]
	}

	// ensure module change list
	// e.g. for fixes: { "module": { "fixes": [] } }
	let list
	switch (change.type) {
		case "fix":
			list = ensure("fixes")
			break
		case "feature":
			list = ensure("features")
			break
		default:
			list = ensure(CHANGE_TYPE_UNKNOWN)
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
