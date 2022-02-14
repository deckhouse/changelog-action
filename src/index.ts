import * as core from "@actions/core"
import { collectReleaseChanges as collectChanges, Inputs, Outputs } from "./changes"
import { Client } from "./client"

async function main() {
	try {
		const inputs: Inputs = {
			token: core.getInput("token"),
			repo: core.getInput("repo"),
			milestone: core.getInput("milestone"),
		}

		const client = new Client(inputs.repo, inputs.token)

		const o = await collectChanges(client, inputs.milestone)

		core.setOutput("patch_yaml", o.patchYaml)
		core.setOutput("patch_markdown", o.patchMarkdown)
		core.setOutput("minor_markdown", o.minorMarkdown)
		core.setOutput("minor_version", o.minorVersion)

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (e: any) {
		core.setFailed(e.message)
	}
}

main()
