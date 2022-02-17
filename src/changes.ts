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

	const milestoneVersion = new MilestoneVersion(milestone)
	if (!milestoneVersion.isValid()) {
		throw new Error(`invalid milestone title "${milestone}", expected version format vX.Y.Z`)
	}
	const client = new Client(inputs.repo, inputs.token)
	const validator = getValidator(allowedSections)

	// Get pulls for current milestone (patch version).
	const milestonePulls = await client.getMilestonePulls(milestone)
	const milestoneChanges = collectChangelog(milestonePulls, validator)

	// Get cumulative changelog for the whole release branch (minor version).
	const branchPulls = [...milestonePulls]
	for (const prevMilestone of milestoneVersion.downToZero()) {
		const pulls = await client.getMilestonePulls(prevMilestone)
		branchPulls.push(...pulls)
	}
	const branchChanges = collectChangelog(branchPulls, validator)

	const out = {
		releaseYaml: formatYaml(milestoneChanges),
		releaseMarkdown: formatMarkdown(milestone, milestoneChanges),
		branchMarkdown: formatMarkdown(milestoneVersion.toMinor(), branchChanges),
		minorVersion: milestoneVersion.toMinor(),
	}
	return out
}

export class MilestoneVersion {
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
	//	given v1.85.3 in value,
	//	yields v1.85.2, v1.85.1, v1.85.0
	*downToZero(): IterableIterator<string> {
		const minor = this.toMinor()
		const maxPatch = this.patchNum()
		for (let p = maxPatch - 1; p >= 0; p--) {
			yield `${minor}.${p}`
		}
	}

	isValid(): boolean {
		return /v\d+\.\d+\.\d+/.test(this.value)
	}
}
