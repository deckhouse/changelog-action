import * as core from "@actions/core"
import { Inputs, collectChanges } from "./changes"
import { PullRequest } from "./parse"

async function run(): Promise<void> {
	try {
		const inputs: Inputs = {
			token: core.getInput("token"),
			pulls: JSON.parse(core.getInput("pull_requests")) as PullRequest[],
		}

		// core.debug(`Inputs: ${inspect(inputs)}`)

		const o = await collectChanges(inputs)
		core.setOutput("yaml", o.yaml)
		core.setOutput("markdown", o.markdown)

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		core.setFailed(error.message)
	}
}

run()
