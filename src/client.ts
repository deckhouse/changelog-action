import { getOctokitOptions, GitHub } from "@actions/github/lib/utils"
import { Octokit } from "@octokit/core"
import { PaginateInterface } from "@octokit/plugin-paginate-rest"
import { Api } from "@octokit/plugin-rest-endpoint-methods/dist-types/types"
import { throttling } from "@octokit/plugin-throttling"

export type Pull = {
	url: string
	number: number
	title: string
	body: string
	state: string
	milestone: {
		number: number
		title: string
		state: "open" | "closed"
	}
}

export class Client {
	private repo: string
	private octokit: Octokit & Api & { paginate: PaginateInterface }

	constructor(repo: string, token: string) {
		this.repo = repo
		const octokit = GitHub.plugin(throttling)
		this.octokit = new octokit(
			getOctokitOptions(token, {
				throttle: {
					onRateLimit: (retryAfter, options, octokit, retryCount) => {
						octokit.log.warn(
							`Request quota exhausted for request ${options.method} ${options.url}`,
						)

						if (retryCount < 3) {
							octokit.log.info(`Retrying after ${retryAfter} seconds!`)
							return true
						}
					},
					onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
						// does not retry, only logs a warning
						octokit.log.warn(
							`SecondaryRateLimit detected for request ${options.method} ${options.url}`,
						)

						if (retryCount < 3) {
							octokit.log.info(`Retrying after ${retryAfter} seconds!`)
							return true
						}
					},
				},
			}),
		)
	}

	async getMilestonePulls(milestone: string): Promise<Pull[]> {
		const q = `repo:${this.repo} is:pr is:merged milestone:${milestone} -label:auto`

		const pulls = await this.octokit.paginate(this.octokit.rest.search.issuesAndPullRequests, { q })

		return pulls.map(
			(p) =>
				({
					url: p.html_url,
					number: p.number,
					title: p.title,
					body: p.body || "",
					state: p.state,
					milestone: {
						// we know the milestone is there since we asked by it
						number: p.milestone?.number,
						title: p.milestone?.title,
						state: p.milestone?.state,
					},
				}) as Pull,
		)
	}
}
