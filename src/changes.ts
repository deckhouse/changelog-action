import { formatMarkdown, formatPartialMarkdown, formatYaml } from "./format"
import { collectChangelog, PullRequest } from "./parse"
import { getValidator } from "./validator"

export interface Inputs {
	token: string
	pulls: PullRequest[]
	allowedSections: string[]
}

export interface Outputs {
	yaml: string
	markdown: string
	partialMarkdown: string
}

// This function expects an array of pull requests belonging to single milestone
export function collectChanges(inputs: Inputs): Outputs {
	const out = { yaml: "", markdown: "", partialMarkdown: "" }

	const { pulls, allowedSections } = inputs
	if (pulls.length === 0) {
		return out
	}

	const validator = getValidator(allowedSections)
	// We assume all PRs have the same milestone
	const milestone = pulls[0].milestone.title
	const changes = collectChangelog(pulls, validator)

	out.yaml = formatYaml(changes)
	out.markdown = formatMarkdown(milestone, changes)
	out.partialMarkdown = formatPartialMarkdown(changes)

	return out
}
