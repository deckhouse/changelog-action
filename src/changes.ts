import { formatYaml, formatMarkdown } from "./format"
import { PullRequest, collectChangelog } from "./parse"

export interface Inputs {
	token: string
	pulls: PullRequest[]
}

export interface Outputs {
	yaml: string
	markdown: string
}

// This function expects an array of pull requests belonging to single milestone
export async function collectChanges(inputs: Inputs): Promise<Outputs> {
	const { pulls } = inputs
	const out = { yaml: "", markdown: "" }

	if (pulls.length === 0) {
		return out
	}

	// Process
	const milestone = pulls[0].milestone.title
	const changesByModule = collectChangelog(pulls)

	out.yaml = formatYaml(changesByModule)
	out.markdown = formatMarkdown(milestone, out.yaml)

	return out
}
