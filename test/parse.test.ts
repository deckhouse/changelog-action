import * as fs from "fs"
import * as path from "path"
import { parseChangeEntries, PullRequest, ChangeEntry, extractChanges } from "./../src/parse"

describe("extracting raw changes", () => {
	function block(content: string, type = "") {
		const delim = "```"
		const start = delim + type
		const end = delim
		return [start, content, end].join("\n")
	}

	test("parses empty line on empty input", () => {
		expect(extractChanges("")).toBe("")
	})

	test("parses single block", () => {
		const input = block("module: one", "changes")
		expect(extractChanges(input)).toBe("module: one")
	})

	test("ignores all blocks except frist one", () => {
		const input = [block("module: one", "changes"), block("module: two", "changes")].join("\n")
		const expected = ["module: one", "module: two"].join("\n---\n")
		expect(extractChanges(input)).toBe(expected)
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
		expect(extractChanges(input)).toBe(expected)
	})

	test("ignores blocks with malformed beginning", () => {
		const input = ["````changes", "module: one", "```"].join("\n")
		expect(extractChanges(input)).toBe("")
	})

	test("ignores blocks with malformed ending", () => {
		const input = ["```changes", "module: one", "````"].join("\n")
		expect(extractChanges(input)).toBe("")
	})

	test("parses two blocks from GitHub JSON", () => {
		const { input, expected } = getTwoBlocksBodyFixture()
		expect(extractChanges(input)).toBe(expected)
	})

	test("ignores HTML comments", () => {
		const input = [
			block("module: one", "changes"),
			"<!--",
			block("module: hidden", "changes"),
			"-->",
			block("module: two", "changes"),
		].join("\n")
		const expected = ["module: one", "module: two"].join("\n---\n")
		expect(extractChanges(input)).toBe(expected)
	})
})

describe("parsing change entries", function () {
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
				new ChangeEntry({
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
				new ChangeEntry({
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
				new ChangeEntry({
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
				new ChangeEntry({
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
				new ChangeEntry({
					module: "mod1",
					type: "fix",
					description: "modification1",
					pull_request: pr.url,
				}),
				new ChangeEntry({
					module: "mod2",
					type: "fix",
					description: "modification2",
					pull_request: pr.url,
				}),
			],
		},
		{
			title: "returns numbers as strings",
			pr,
			input: column([
				//
				module("11"),
				type("fix"),
				description("-55"),
				note("42"),
			]),
			want: [
				new ChangeEntry({
					module: "11",
					type: "fix",
					description: "-55",
					note: "42",
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
				new ChangeEntry({
					module: "mod1",
					type: "fix",
					description: "modification1",
					pull_request: pr.url,
				}),

				new ChangeEntry({
					module: "UNKNOWN",
					type: "unknown",
					description: "Shmoo",
					pull_request: pr.url,
				}),
				new ChangeEntry({
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
				new ChangeEntry({
					module: "mod1",
					type: "fix",
					description: "Shmoo",
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
				new ChangeEntry({
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
				new ChangeEntry({
					module: "UNKNOWN",
					type: "fix",
					description: "pewpew",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "fills all passed inputs in order from Github JSON",
			pr,
			input: extractChanges(getTwoBlocksBodyFixture().input),
			want: [
				new ChangeEntry({
					module: "cloud-provider-something",
					type: "fix",
					description: "inexistence was not acknowledged",
					note: "restarts nothing",
					pull_request: pr.url,
				}),
				new ChangeEntry({
					module: "UNKNOWN",
					type: "feature",
					description: "no module hehehe",
					pull_request: pr.url,
				}),
				new ChangeEntry({
					module: "cloud-provider-something",
					type: "unknown",
					description: "error in type hehehe",
					pull_request: pr.url,
				}),
				new ChangeEntry({
					module: "cloud-provider-something",
					type: "fix",
					description: "Shmoo",
					pull_request: pr.url,
				}),
				new ChangeEntry({
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
		const change = parseChangeEntries(pr, c.input)
		expect(change).toStrictEqual(c.want)
	})
})

function getTwoBlocksBodyFixture() {
	const dir = "./test/fixtures"
	const bodyFile = "pr_body_2_blocks.json"
	const changeFile1 = "pr_body_2_blocks_change_1.yml"
	const changeFile2 = "pr_body_2_blocks_change_2.yml"

	const read = (name) => fs.readFileSync(path.join(dir, name), { encoding: "utf8" })

	const input = JSON.parse(read(bodyFile)).body
	const changes1 = read(changeFile1)
	const changes2 = read(changeFile2)

	const expected = [changes1, changes2].join("\n---\n")

	return { input, expected }
}
