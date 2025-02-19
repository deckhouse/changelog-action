import * as core from "@actions/core"
import * as github from "@actions/github"
import { collectReleaseChanges as collectChanges, Inputs } from "./changes"
import { CheckInput, checkPREntry } from "./check";

async function main() {
	try {
		const check = core.getInput("check")
		const checkMode = check.toLowerCase() === "true"
		if (checkMode) {
			core.info("Running in check mode")
			const pr = github.context.payload.pull_request
			if (!pr) {
				core.setFailed("No pull request found in the GitHub context.")
				return
			}
			const checkInputs: CheckInput = {
				pr: pr,
				allowedSections: parseList(core.getInput("allowed_sections")),
			}
			await checkPREntry(checkInputs)
			return
		}
		const inputs: Inputs = {
			token: core.getInput("token"),
			repo: core.getInput("repo"),
			milestone: core.getInput("milestone"),
			allowedSections: parseList(core.getInput("allowed_sections")),
		}

		core.debug(`Inputs: ${JSON.stringify(inputs)}`)

		const o = await collectChanges(inputs)

		core.setOutput("release_yaml", o.releaseYaml)
		core.setOutput("release_markdown", o.releaseMarkdown)
		core.setOutput("branch_markdown", o.branchMarkdown)
		core.setOutput("minor_version", o.minorVersion)

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (e: any) {
		core.setFailed(e.message)
	}
}

export function parseList(s: string): string[] {
	return s
		.split(/[\n,\s]+/)
		.map((s) => s.trim())
		.filter((s) => s !== "")
}

main()
