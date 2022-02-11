import { formatMarkdown, formatPartialMarkdown, formatYaml } from "./format"
import { collectChangelog, PullRequest } from "./parse"

export interface Inputs {
	token: string
	pulls: PullRequest[]
}

export interface Outputs {
	yaml: string
	markdown: string
	partialMarkdown: string
}

// This function expects an array of pull requests belonging to single milestone
export function collectChanges(inputs: Inputs): Outputs {
	const { pulls } = inputs
	const out = { yaml: "", markdown: "", partialMarkdown: "" }

	if (pulls.length === 0) {
		return out
	}

	// We assume all PRs have the same milestone
	const milestone = pulls[0].milestone.title
	const changes = collectChangelog(pulls)

	out.yaml = formatYaml(changes)
	out.markdown = formatMarkdown(milestone, changes)
	out.partialMarkdown = formatPartialMarkdown(changes)

	return out
}
