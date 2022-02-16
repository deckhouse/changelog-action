import * as core from "@actions/core"
import { collectReleaseChanges as collectChanges, Inputs } from "./changes"

async function main() {
	try {
		const inputs: Inputs = {
			token: core.getInput("token"),
			repo: core.getInput("repo"),
			milestone: core.getInput("milestone"),
			allowedSections: parseList(core.getInput("allowed_sections")),
		}
		// core.debug(`Inputs: ${inspect(inputs)}`)

		const o = await collectChanges(inputs)

		core.setOutput("patch_yaml", o.patchYaml)
		core.setOutput("patch_markdown", o.patchMarkdown)
		core.setOutput("minor_markdown", o.minorMarkdown)
		core.setOutput("minor_version", o.minorVersion)

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (e: any) {
		core.setFailed(e.message)
	}
}

function parseList(s: string): string[] {
	return s
		.split(/[\n,]+/)
		.map((s) => s.trim())
		.filter((s) => s !== "")
}

main()
