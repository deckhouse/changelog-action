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
 * ModuleChanges describes changes in single module
 */
export interface ModuleChanges {
	fixes?: Change[]
	features?: Change[]
	unknown?: Change[]
}

export function collectChangelog(pulls: PullRequest[]): ChangesByModule {
	return (
		pulls
			.filter((pr) => pr.state == "MERGED")
			// parse changes in PR body
			.map((pr) => ({ pr, rawChanges: extractChangesBlock(pr.body) }))
			// collect change units
			.flatMap(({ pr, rawChanges }) => parsePrChanges(pr, rawChanges))
			.reduce(groupByModule, {})
	)
}

/**
 *
 * rawChanges example:
 *
 * ```changes
 * module: module3
 * type: fix
 * description: what was fixed in 151
 * note: Network flap is expected, but no longer than 10 seconds
 * ---
 * module: module3
 * type: feature
 * description: added big thing to enhance security
 * ```
 *
 */
export function parsePrChanges(pr: PullRequest, rawChanges: string): PullRequestChange[] {
	return yaml //
		.loadAll(rawChanges)
		.map((doc) => convPrChange(doc as Partial<PullRequestChangeOpts>, pr))
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
function convPrChange(doc: Partial<PullRequestChangeOpts>, pr: PullRequest): PullRequestChange {
	const fallback = fallbackConvPrChange(pr)

	const module = doc.module || fallback.module
	const type = doc.type && knownTypes.has(doc.type) ? doc.type : fallback.type
	const description = (doc.description && doc.description.trim()) || fallback.description

	const opts: PullRequestChangeOpts = {
		module,
		type,
		description,
		pull_request: pr.url,
	}

	const note = doc.note?.trim()
	if (note) opts.note = note

	return new PullRequestChange(opts)
}

const CHANGE_TYPE_UNKNOWN = "unknown"
const MODULE_UNKNOWN = "UNKNOWN"

function fallbackConvPrChange(pr: PullRequest): PullRequestChange {
	return new PullRequestChange({
		module: MODULE_UNKNOWN,
		type: CHANGE_TYPE_UNKNOWN,
		description: `${pr.title} (#${pr.number})`,
		pull_request: pr.url,
	})
}

// extractChangesBlock parses only first changes block it meets
export function extractChangesBlock(body: string): string {
	const delim = "```"
	const start = new RegExp(`^${delim}changes\\s*$`, "m")
	const end = new RegExp(`^${delim}\\s*$`, "m")

	// Fix new lines

	const [, ...contents] = body.replace(/\r/g, "").split(start)
	if (contents.length == 0) {
		return ""
	}

	return contents
		.filter((c) => end.test(c)) //  filter by end presence
		.map((c) => c.split(end)[0]) // pick block content
		.filter((x) => !!x) //          filter undefined
		.map((s) => s.trim()) //        find empty content
		.filter((x) => !!x) //          filter empty content
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

export class PullRequestChange extends Change {
	module = ""
	type = ""

	constructor(o: PullRequestChangeOpts) {
		super(o)
		this.module = o.module
		this.type = o.type
	}

	// All required fields should be filled
	valid(): boolean {
		return !!this.module && !!this.type && super.valid()
	}
}
interface PullRequestChangeOpts extends ChangeOpts {
	module: string
	type: string
}

function groupByModule(acc: ChangesByModule, change: PullRequestChange) {
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
