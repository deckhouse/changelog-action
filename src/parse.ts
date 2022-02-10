import * as yaml from "js-yaml"
import { marked } from "marked"
import { hasUncaughtExceptionCaptureCallback } from "process"

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
	fixes?: ChangeContent[]
	features?: ChangeContent[]
}

export function collectChangelog(pulls: PullRequest[]): ChangeEntry[] {
	return pulls
		.map((pr) => ({ pr, changesYAMLs: extractChanges(pr.body) }))
		.flatMap(({ pr, changesYAMLs }) => parseChangeEntries(pr, changesYAMLs))
}

/**
 * changesYAMLs example:
 *
 *   module: module3
 *   type: fix
 *   description: what was fixed in 151
 *   note: Network flap is expected, but no longer than 10 seconds
 *   ,
 *   module: module3
 *   type: feature
 *   description: added big thing to enhance security
 *
 */
export function parseChangeEntries(pr: PullRequest, changesYAMLs: string[]): ChangeEntry[] {
	const entries = [] as ChangeEntry[]
	for (const changeYAML of changesYAMLs) {
		try {
			const doc = yaml.load(changeYAML, { schema: yaml.FAILSAFE_SCHEMA })
			if (!doc) {
				const change = createEmptyChange(pr)
				entries.push(change)
				continue
			}
			const opts = parseInput(doc as ChangeInput, pr)
			const change = new ChangeEntry(opts)
			entries.push(change)
		} catch (e) {
			if (!(e instanceof yaml.YAMLException)) {
				throw e
			}
			const change = createEmptyChange(pr)
			entries.push(change)
		}
	}
	return entries
}

const TYPE_FIX = "fix"
const TYPE_FEATURE = "feature"
const knownTypes = new Set([TYPE_FIX, TYPE_FEATURE])

const LEVEL_HIGH = "high"
const LEVEL_LOW = "low"
const knownLevels = new Set([LEVEL_LOW, LEVEL_HIGH])

function sanitizeString(x: unknown): string {
	if (typeof x === "string") {
		return x.trim()
	}

	if (Number.isFinite(x) || x) {
		// not null, not undefined, and not empty string
		return `${x}`
	}

	return ""
}

function createEmptyChange(pr: PullRequest): ChangeEntry {
	return new ChangeEntry({
		section: "",
		type: "",
		summary: "",
		pull_request: pr.url,
	})
}

/*
 * extractChanges parses changes blocks from PR body
 *
 *  Tokens we look for look like this
 * {
 *   "type": "code",
 *   "raw": "```changes\nmodule: upmeter\ntype: feature\ndescription: Assign more specific nodes for the server pod\n```",
 *   "lang": "changes",
 *   "text": "module: upmeter\ntype: feature\ndescription: Assign more specific nodes for the server pod"
 * }
 *
 */
export function extractChanges(body: string): string[] {
	// Turn on Github Flavored Markdown.
	// See other options here: https://marked.js.org/using_advanced#options
	const lexer = new marked.Lexer({ gfm: true })

	const parsed = lexer.lex(body)
	const changeBlocks = parsed
		.filter((t): t is marked.Tokens.Code => t.type == "code" && t.lang == "changes")
		.map((t) => t.text)

	return changeBlocks
}

/**
 *  ChangeContent is the content to be printed on the lowest level
 */
export class ChangeContent {
	summary = ""
	pull_request = ""
	impact?: string

	constructor(o: ChangeOpts) {
		this.summary = o.summary
		this.pull_request = o.pull_request
		if (o.impact) {
			this.impact = o.impact
		}
	}

	// All required fields should be filled
	valid(): boolean {
		const errs = this.validate()
		return errs.length === 0
	}

	// All required fields should be filled
	validate(): string[] {
		const errs: string[] = []
		if (!this.summary) {
			errs.push("missing summary")
		}
		if (!this.pull_request) {
			throw new Error("missing pull_request")
		}
		return errs
	}
}
interface ChangeOpts {
	summary: string
	pull_request: string
	impact?: string
}

/**
 *  ChangeEntry is the change data we expect to find in pull request
 */
export class ChangeEntry extends ChangeContent {
	section = ""
	type = ""
	level = ""

	constructor(o: ChangeEntryOpts) {
		super(o)
		this.section = o.section
		this.type = o.type
		if (o.impact_level) {
			this.level = o.impact_level
		}
	}

	validate(): string[] {
		const errs: string[] = []

		// validate level
		if (!!this.level && !knownLevels.has(this.level)) {
			errs.push(`invalid impact level "${this.level}"`)
		}

		// validate impact presense when the level is high
		if (this.level === LEVEL_HIGH && !this.impact) {
			errs.push("missing high impact detail")
		}

		if (!this.section) {
			errs.push("missing section/module")
		}

		if (!knownTypes.has(this.type)) {
			errs.push(this.type ? `invalid type "${this.type}"` : "missing type")
		}

		errs.push(...super.validate())

		return errs.sort()
	}
}
interface ChangeEntryOpts extends ChangeOpts {
	section: string
	type: string
	impact_level?: string
}

interface ChangeInput extends ChangeInputVersion1, ChangeInputVersion2 {}
interface ChangeInputVersion1 extends ChangeOpts {
	module: string
	type: string
	description: string
	note?: string
}

interface ChangeInputVersion2 extends ChangeOpts {
	section: string
	type: string
	summary: string
	impact?: string
	impact_level?: string
}

/**
 *
 * doc is an object made from 'changes' YAML doc, e.g.
 *
 * // deprecated version
 * {
 *   "module": "module3",
 *   "type": "fix",
 *   "description": "what was fixed in 151",
 *   "note": "Network flap is expected, but no longer than 10 seconds",
 * }
 *
 * OR
 *
 * // modern version
 * {
 *   "section": "module3",
 *   "type": "fix",
 *   "summary": "what was fixed in 151",
 *   "impact": "Network flap is expected, but no longer than 10 seconds",
 * }
 */
function parseInput(doc: ChangeInput, pr: PullRequest): ChangeEntryOpts {
	const opts: ChangeEntryOpts = {
		section: sanitizeString(doc.module) || sanitizeString(doc.section) || "",
		type: sanitizeString(doc.type) || "",
		summary: sanitizeString(doc.description) || sanitizeString(doc.summary) || "",
		pull_request: pr.url,
	}

	const impact = sanitizeString(doc.note) || sanitizeString(doc.impact)
	if (impact) {
		opts.impact = impact
	}

	const impactLevel = sanitizeString(doc.impact_level)
	if (impactLevel) {
		opts.impact_level = impactLevel
	}

	return opts
}
