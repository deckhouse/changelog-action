import * as core from "@actions/core"
import * as github from "@actions/github"
import { collectReleaseChanges as collectChanges, Inputs } from "./changes"
import { ValidateInput, validatePREntry } from "./check"

async function main() {
	try {
		const validate = core.getInput("validate_only")
		const validateMode = validate.toLowerCase() === "true"
		if (validateMode) {
			core.info("Running in validate mode")
			const pr = github.context.payload.pull_request
			if (!pr) {
				core.setFailed("No pull request found in the GitHub context.")
				return
			}
			const validateInputs: ValidateInput = {
				pr: pr,
				allowedSections: parseList(core.getInput("allowed_sections")),
			}
			const isValid = await validatePREntry(validateInputs)
			core.setOutput("is_valid_changelog_entry", isValid)
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
