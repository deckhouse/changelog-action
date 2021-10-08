import exp from "constants"
import * as fs from "fs"
import * as path from "path"
import { parsePrChanges, PullRequest, PullRequestChange, extractChangesBlock } from "./../src/parse"

describe("extractChangesBlock", () => {
	function block(content: string, type = "") {
		const delim = "```"
		const start = delim + type
		const end = delim
		return [start, content, end].join("\n")
	}

	test("parses empty line on empty input", () => {
		expect(extractChangesBlock("")).toBe("")
	})

	test("parses single block", () => {
		const input = block("module: one", "changes")
		expect(extractChangesBlock(input)).toBe("module: one")
	})

	test("ignores all blocks except frist one", () => {
		const input = [block("module: one", "changes"), block("module: two", "changes")].join("\n")
		const expected = ["module: one", "module: two"].join("\n---\n")
		expect(extractChangesBlock(input)).toBe(expected)
	})

	test("ignores non-changes blocks ", () => {
		const input = [
			block("nothing"),
			"",
			block("yaml", "yaml"),
			block("module: one", "changes"),
			block("shell", "shell"),
			"",
			block("module: two", "changes"),
			block("nothing2"),
		].join("\n")
		const expected = ["module: one", "module: two"].join("\n---\n")
		expect(extractChangesBlock(input)).toBe(expected)
	})

	test("ignores blocks with malformed beginning", () => {
		const input = ["````changes", "module: one", "```"].join("\n")
		expect(extractChangesBlock(input)).toBe("")
	})

	test("ignores blocks with malformed ending", () => {
		const input = ["```changes", "module: one", "````"].join("\n")
		expect(extractChangesBlock(input)).toBe("")
	})

	test("parses two blocks", () => {
		const { input, expected } = getTwoBlocksBodyFixture()
		expect(extractChangesBlock(input)).toBe(expected)
	})
})

describe("parsePullRequestChanges", function () {
	const delim = "---"
	const emptyLine = ""
	const column = (ss) => ss.join("\n") + "\n"
	const kv = (k, v) => `${k}: ${v}`
	const module = (x) => kv("module", x)
	const type = (x) => kv("type", x)
	const description = (x) => kv("description", x)
	const note = (x) => kv("note", x)

	const pr: PullRequest = {
		url: "https://github.com/owner/repo/pulls/13",
		title: "Shmoo",
		number: 13,
		state: "",
		body: "",
		milestone: { title: "v1.23.456", number: 2 },
	}

	const cases = [
		{
			title: "parses minimal input",
			pr,
			input: column([
				//
				module("mod"),
				type("fix"),
				description("something was done"),
			]),
			want: [
				new PullRequestChange({
					module: "mod",
					type: "fix",
					description: "something was done",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "parses multi-line text field",
			pr,
			input: column([
				//
				module("multiline"),
				type("fix"),
				description(
					column([
						//
						"|",
						"  something was done:",
						emptyLine,
						"  parses input with colons in values",
					]),
				),
			]),
			want: [
				new PullRequestChange({
					module: "multiline",
					type: "fix",
					description: "something was done:\n\nparses input with colons in values",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "parses note field",
			pr,
			input: column([
				//
				module("modname"),
				type("fix"),
				description("something was done"),
				note("parses note field"),
			]),
			want: [
				new PullRequestChange({
					module: "modname",
					type: "fix",
					description: "something was done",
					note: "parses note field",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "tolerates empty lines",
			pr,
			input: column([
				emptyLine,
				module("modname"),
				emptyLine,
				type("fix"),
				emptyLine,
				description("something was done"),
				emptyLine,
				note("we xpect some outage"),
				emptyLine,
			]),
			want: [
				new PullRequestChange({
					module: "modname",
					type: "fix",
					description: "something was done",
					note: "we xpect some outage",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "parses multiple docs",
			pr,
			input: column([
				module("mod1"),
				type("fix"),
				description("modification1"),
				delim,
				module("mod2"),
				type("fix"),
				description("modification2"),
			]),
			want: [
				new PullRequestChange({
					module: "mod1",
					type: "fix",
					description: "modification1",
					pull_request: pr.url,
				}),
				new PullRequestChange({
					module: "mod2",
					type: "fix",
					description: "modification2",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "returns fallback change for malformed docs",
			pr,
			input: column([
				module("mod1"),
				type("fix"),
				description("modification1"),
				delim,
				kv("x", "y"),
				delim,
				module("mod2"),
				type("fix"),
				description("modification2"),
			]),
			want: [
				new PullRequestChange({
					module: "mod1",
					type: "fix",
					description: "modification1",
					pull_request: pr.url,
				}),

				new PullRequestChange({
					module: "UNKNOWN",
					type: "unknown",
					description: `${pr.title} (#${pr.number})`,
					pull_request: pr.url,
				}),
				new PullRequestChange({
					module: "mod2",
					type: "fix",
					description: "modification2",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "returns fallback change for missing description",
			pr,
			input: column([
				//
				module("mod1"),
				type("fix"),
			]),
			want: [
				new PullRequestChange({
					module: "mod1",
					type: "fix",
					description: `${pr.title} (#${pr.number})`,
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "substitutes unknown type with `unknown`",
			pr,
			input: column([
				//
				module("mod1"),
				type("bigfix"),
				description("pewpew"),
			]),
			want: [
				new PullRequestChange({
					module: "mod1",
					type: "unknown",
					description: "pewpew",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "returns fallback change for missing `module`",
			pr,
			input: column([
				//
				type("fix"),
				description("pewpew"),
			]),
			want: [
				new PullRequestChange({
					module: "UNKNOWN",
					type: "fix",
					description: "pewpew",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "fills all passed inputs in order",
			pr,
			input: extractChangesBlock(getTwoBlocksBodyFixture().input),
			want: [
				new PullRequestChange({
					module: "cloud-provider-something",
					type: "fix",
					description: "inexistence was not acknowledged",
					note: "restarts nothing",
					pull_request: pr.url,
				}),
				new PullRequestChange({
					module: "UNKNOWN",
					type: "feature",
					description: "no module hehehe",
					pull_request: pr.url,
				}),
				new PullRequestChange({
					module: "cloud-provider-something",
					type: "unknown",
					description: "error in type hehehe",
					pull_request: pr.url,
				}),
				new PullRequestChange({
					module: "cloud-provider-something",
					type: "fix",
					description: "Shmoo (#13)",
					pull_request: pr.url,
				}),
				new PullRequestChange({
					module: "cloud-provider-something",
					type: "fix",
					description: "better to be than no to be",
					note: "from separate changes block",
					pull_request: pr.url,
				}),
			],
		},
	]

	test.each(cases)("$title", function (c) {
		const change = parsePrChanges(pr, c.input)
		expect(change).toStrictEqual(c.want)
	})
})

function getTwoBlocksBodyFixture() {
	const dir = "./test/fixtures"
	const bodyFile = "pr_body_2_blocks.md"
	const changeFile1 = "pr_body_2_blocks_change_1.md"
	const changeFile2 = "pr_body_2_blocks_change_2.md"

	const read = (name) => fs.readFileSync(path.join(dir, name), { encoding: "utf8" })

	const input = read(bodyFile)
	const changes1 = read(changeFile1)
	const changes2 = read(changeFile2)

	const expected = [changes1, changes2].join("\n---\n")

	return { input, expected }
}
