import github from "@actions/github"
import { Octokit } from "@octokit/core"
import { PaginateInterface } from "@octokit/plugin-paginate-rest"
import { Api } from "@octokit/plugin-rest-endpoint-methods/dist-types/types"

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
		this.octokit = github.getOctokit(token)
	}

	async getMilestonePulls(milestone: string): Promise<Pull[]> {
		const q = `repo:${this.repo} is:pr is:merged milestone:${milestone} -label:auto`

		const pulls = await this.octokit.paginate(this.octokit.rest.search.issuesAndPullRequests, { q })

		return pulls.map(
			(p) =>
				({
					url: p.url,
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
				} as Pull),
		)
	}
}
