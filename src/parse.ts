import * as yaml from "js-yaml"
import { marked } from "marked"

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
			const doc = yaml.load(changeYAML)
			const change = parseChange(doc as Partial<ChangeEntryOpts>, pr)
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
function parseChange(doc: Partial<ChangeEntryOpts>, pr: PullRequest): ChangeEntry {
	const opts: ChangeEntryOpts = {
		module: sanitizeString(doc.module) ?? "",
		type: sanitizeString(doc.type) ?? "",
		description: sanitizeString(doc.description) ?? "",
		pull_request: pr.url,
	}

	const note = sanitizeString(doc.note)
	if (note) {
		opts.note = note
	}

	return new ChangeEntry(opts)
}

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
		module: "",
		type: "",
		description: "",
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
		.filter((t: marked.Token): t is marked.Tokens.Code => t.type == "code" && t.lang == "changes")
		.map((t: marked.Tokens.Code) => t.text)

	// console.log("PARSED", parsed)
	// console.log("CHANGES/", changeBlocks)

	return changeBlocks
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
 *  ChangeEntry is the change we expect to find in pull request
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
		return !!this.module && knownTypes.has(this.type) && super.valid()
	}
}
interface ChangeEntryOpts extends ChangeOpts {
	module: string
	type: string
}
