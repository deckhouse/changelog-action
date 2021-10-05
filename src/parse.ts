/*
  pullRequests example:

  [
    {
      "body": "Pull reqeust containing changelog\r\n\r\n```changes\r\n- module: upmeter\r\n  type: fix\r\n  description: correct group   uptime calculation\r\n  fixes_issues:\r\n    - 13\r\n```\r\n\r\nFollowing is extra comments.",
      "milestone": {
	"number": 2,
	"title": "v1.40.0",
	"description": "",
	"dueOn": null
      },
      "number": 1,
      "state": "MERGED",
      "title": "WIP action draft",
      "url": "..."
    },
    {
      "body": "body\r\nbody\r\nbody\r\n\r\n```changes\r\n- module: \"inexisting\"\r\n  type: bug\r\n  description: inexistence was not acknowledged\r\n  resolves: [ \"#6\" ]\r\n  will_restart: null\r\n```",
      "milestone": {
	"number": 2,
	"title": "v1.40.0",
	"description": "",
	"dueOn": null
      },
      "number": 3,
      "state": "MERGED",
      "title": "add two",
      "url": "..."
    }
  ]
*/

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
interface ModuleChanges {
	fixes?: Change[]
	features?: Change[]
	unknown?: Change[]
}
// pull requests object => changes by modules
export function collectChangelog(pulls: PullRequest[]): ChangesByModule {
	return pulls
		.filter((pr) => pr.state == "MERGED")
		.map((pr) => parsePullRequestChanges(pr, parseSingleChange, fallbackChange))
		.reduce(groupByModule, {})
}

export function parsePullRequestChanges(
	pr: PullRequest,
	parseOne: (PullRequest, string) => PullRequestChange,
	fallback: (PullRequest) => PullRequestChange,
): PullRequestChange[] {
	let rawChanges = ""

	try {
		rawChanges = pr.body.split("```changes")[1].split("```")[0]
	} catch (e) {
		return [fallback(pr)]
	}

	// TODO parse YAML docs
	const changes = rawChanges
		.split("---")
		.filter((x) => !!x.trim()) // exclude empty strings
		.map((raw) => parseOne(pr, raw))

	if (changes.length == 0 || changes.some((c) => !c.valid())) {
		console.log("fallback under conditions")
		return [fallback(pr)]
	}

	return changes
}
/**
 * @function parseChange parses raw text entry to change object. Multi-line values are not supported.
 * @param {{ url: string; }} pr
 * @param {string} raw
 *
 * Input:
 *
 * `pr`:
 *
 * ```json
 * pr = {
 *   "url": "https://github.com/owner/repo/pulls/151"
 * }
 * ```
 *
 * `raw`:
 *
 * ```change
 * module: module3
 * type: fix
 * description: what was fixed in 151
 * resolves: #16, #32
 * note: Network flap is expected, but no longer than 10 seconds
 * ```
 *
 * Output:
 * ```json
 * {
 *   "module": "module3",
 *   "type": "fix",
 *   "description": "what was fixed in 151",
 *   "note": "Network flap is expected, but no longer than 10 seconds",
 *   "resolves": [
 *     "https://github.com/deckhouse/dekchouse/issues/16",
 *     "https://github.com/deckhouse/dekchouse/issues/32"
 *   ],
 *   "pull_request": "https://github.com/deckhouse/dekchouse/pulls/151"
 * }
 * ```
 *
 */
export function parseSingleChange(pr: PullRequest, raw: string): PullRequestChange {
	const opts: PullRequestChangeOpts = {
		module: "",
		type: "",
		description: "",
		pull_request: pr.url,
	}

	const lines = raw.split("\n")
	for (const line of lines) {
		if (!line.trim()) {
			continue
		}

		const [k, ...vs] = line.split(":")
		const v = vs.join(":").trim()

		if (!prChangeFields.has(k)) {
			continue // set only known keys
		}
		opts[k] = v
	}

	return new PullRequestChange(opts)
}
const prChangeFields = new Set(["module", "type", "description", "note", "pull_request"])
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
const CHANGE_TYPE_UNKNOWN = "unknown"
function fallbackChange(pr: PullRequest): PullRequestChange {
	return new PullRequestChange({
		module: "UNKNOWN",
		type: CHANGE_TYPE_UNKNOWN,
		description: `${pr.title} (#${pr.number})`,
		pull_request: pr.url,
	})
}
function groupByModule(acc: ChangesByModule, changes: PullRequestChange[]): ChangesByModule {
	for (const c of changes) {
		try {
			addChange(acc, c)
		} catch (e) {
			console.log(`by module = ${JSON.stringify(acc, null, 2)}`)
			console.error(`cannot add change ${JSON.stringify(c, null, 2)}`)
			throw e
		}
	}
	return acc
}
function addChange(acc: ChangesByModule, change: PullRequestChange) {
	// ensure module key:   { "module": {} }
	acc[change.module] = acc[change.module] || ({} as ModuleChanges)
	const mc = acc[change.module]
	const ensure = (k) => {
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
		case CHANGE_TYPE_UNKNOWN:
			list = ensure("UNKNOWN")
			break
		default:
			throw new Error(`unknown change type "${change.type}"`)
	}

	// add the change
	list.push(
		new Change({
			description: change.description,
			pull_request: change.pull_request,
			note: change.note,
		}),
	)
}
