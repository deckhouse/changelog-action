import { Client } from "./client"
import { ChangesWithVersion, formatCumulatieMarkdown, formatMarkdown, formatYaml } from "./format"
import { parseChanges } from "./parse"

export interface Inputs {
	token: string
	repo: string
	milestone: string
}

export interface Outputs {
	patchYaml: string
	patchMarkdown: string
	minorMarkdown: string
}

// This function expects an array of pull requests belonging to single milestone
export async function collectReleaseChanges(client: Client, milestone: string): Promise<Outputs> {
	const version = new Version(milestone)
	if (!version.isValid()) {
		throw new Error(`unexpected version "${milestone}"`)
	}

	const out = { patchYaml: "", patchMarkdown: "", minorMarkdown: "" }

	// Get pulls for current patch relese
	const pulls = await client.getMilestonePulls(milestone)
	if (pulls.length > 0) {
		const changes = parseChanges(pulls)
		out.patchYaml = formatYaml(changes)
		out.patchMarkdown = formatMarkdown(milestone, changes)
	}

	// Get cumulative changelog. Here we define the sorting down to oldest versions.
	const cumulativeChanges = [] as ChangesWithVersion[]
	for (const prevPatchVersion of version.downToZero()) {
		const pulls = await client.getMilestonePulls(prevPatchVersion)
		const changes = parseChanges(pulls)
		cumulativeChanges.push({
			version: prevPatchVersion,
			changes,
		})
	}
	out.minorMarkdown = formatCumulatieMarkdown(version.toMinor(), cumulativeChanges)

	return out
}

class Version {
	constructor(private ver: string) {}

	toMinor(): string {
		const vs = this.ver.split(".") // v1.39.3 -> ["v1", "39", "3"]
		return vs[0] + "." + vs[1] // "v1.39"
	}

	patchNum(): number {
		const vs = this.ver.split(".") // v1.39.3 -> ["v1", "39", "3"]
		const p = vs[vs.length - 1] // "3"
		return parseInt(p, 10)
	}

	*downToZero(): IterableIterator<string> {
		const minor = this.toMinor()
		const maxPatch = this.patchNum()
		for (let p = maxPatch - 1; maxPatch >= 0; p--) {
			yield `${minor}.${p}`
		}
	}

	isValid(): boolean {
		return true
	}
}
