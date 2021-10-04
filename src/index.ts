import * as core from "@actions/core"
import { Inputs, PullRequest, collectChanges } from "./changes"

async function run(): Promise<void> {
	try {
		const inputs: Inputs = {
			token: core.getInput("token"),
			pulls: JSON.parse(core.getInput("pull_requests")) as PullRequest[],
		}

		// core.debug(`Inputs: ${inspect(inputs)}`)

		const body = await collectChanges(inputs)
		core.setOutput("body", body)
	} catch (error: any) {
		core.setFailed(error.message)
	}
}

run()
