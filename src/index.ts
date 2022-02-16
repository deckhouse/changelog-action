import * as core from "@actions/core"
import { collectChanges, Inputs } from "./changes"
import { PullRequest } from "./parse"

function run() {
	try {
		const inputs: Inputs = {
			token: core.getInput("token"),
			pulls: JSON.parse(core.getInput("pull_requests")) as PullRequest[],
			allowedSections: parseList(core.getInput("allowed_sections")),
		}

		// core.debug(`Inputs: ${inspect(inputs)}`)

		const o = collectChanges(inputs)

		core.setOutput("yaml", o.yaml)
		core.setOutput("markdown", o.markdown)
		core.setOutput("partial_markdown", o.partialMarkdown)

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		core.setFailed(error.message)
	}
}

function parseList(s: string): string[] {
	return s
		.split(/[\n,]+/)
		.map((s) => s.trim())
		.filter((s) => s !== "")
}

run()
