import { Client } from "./client"
import { formatMarkdown, formatYaml } from "./format"
import { collectChangelog } from "./parse"
import { getValidator } from "./validator"

export interface Inputs {
	// pulls: PullRequest[]
	token: string
	repo: string
	milestone: string
	allowedSections: string[]
}

export type Outputs = {
	releaseYaml: string
	releaseMarkdown: string
	branchMarkdown: string
	minorVersion: string
}

// This function expects an array of pull requests belonging to single milestone
export async function collectReleaseChanges(inputs: Inputs): Promise<Outputs> {
	const { milestone, allowedSections } = inputs

	const version = new MilestoneVersion(milestone)
	if (!version.isValid()) {
		throw new Error(`unexpected version "${milestone}"`)
	}

	const out = {
		releaseYaml: "",
		releaseMarkdown: "",
		branchMarkdown: "",
		minorVersion: version.toMinor(),
	}

	const client = new Client(inputs.repo, inputs.token)
	const validator = getValidator(allowedSections)

	// Get pulls for current patch relese
	const releasePulls = await client.getMilestonePulls(milestone)
	if (releasePulls.length == 0) {
		return out
	}
	const changes = collectChangelog(releasePulls, validator)
	out.releaseYaml = formatYaml(changes)
	out.releaseMarkdown = formatMarkdown(milestone, changes)

	// Get cumulative changelog for the whole release branch (minor version).
	const branchPulls = [...releasePulls]
	for (const prevPatchVersion of version.downToZero()) {
		const pulls = await client.getMilestonePulls(prevPatchVersion)
		branchPulls.push(...pulls)
	}
	const allChanges = collectChangelog(releasePulls, validator)
	out.branchMarkdown = formatMarkdown(version.toMinor(), allChanges)

	return out
}

class MilestoneVersion {
	constructor(private value: string) {}

	toMinor(): string {
		const vs = this.value.split(".") // v1.85.3 -> ["v1", "85", "3"]
		return vs[0] + "." + vs[1] // "v1.85"
	}

	patchNum(): number {
		const vs = this.value.split(".") // v1.85.3 -> ["v1", "85", "3"]
		const p = vs[vs.length - 1] // "3"
		return parseInt(p, 10)
	}

	// Iterates down, excludes current version
	// E.g.
	//	given v1.85.3 in args,
	//	yields v1.85.2, v1.85.1, v1.85.0
	*downToZero(): IterableIterator<string> {
		const minor = this.toMinor()
		const maxPatch = this.patchNum()
		for (let p = maxPatch - 1; p >= 0; p--) {
			yield `v${minor}.${p}`
		}
	}

	isValid(): boolean {
		return /v\d+\.\d+\.\d+/.test(this.value)
	}
}
