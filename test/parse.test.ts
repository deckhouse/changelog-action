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
		expect(extractChanges("")).toStrictEqual([])
	})

	test("parses single block", () => {
		const input = block("module: one", "changes")
		const parsed = extractChanges(input)
		expect(parsed).toStrictEqual(["module: one"])
	})

	test("ignores all blocks except frist one", () => {
		const input = [block("module: one", "changes"), block("module: two", "changes")].join("\n")

		const parsed = extractChanges(input)
		expect(parsed).toStrictEqual(["module: one", "module: two"])
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
		const parsed = extractChanges(input)
		expect(parsed).toStrictEqual(["module: one", "module: two"])
	})

	test("ignores blocks with malformed beginning", () => {
		const input = ["````changes", "module: one", "```"].join("\n")
		const parsed = extractChanges(input)
		expect(parsed).toStrictEqual([])
	})

	test("tolerates blocks with malformed ending due (the `marked` lib works so)", () => {
		const input = ["```changes", "module: one", "````"].join("\n")
		const parsed = extractChanges(input)
		expect(parsed).toStrictEqual(["module: one"])
	})

	test("parses two blocks from GitHub JSON", () => {
		const { input, expected } = getTwoBlocksBodyFixture()
		const parsed = extractChanges(input)
		expect(parsed).toStrictEqual(expected)
	})

	test("ignores HTML comments", () => {
		const input = [
			block("module: one", "changes"),
			"<!--",
			block("module: hidden", "changes"),
			"-->",
			block("module: two", "changes"),
		].join("\n")
		const parsed = extractChanges(input)
		expect(parsed).toStrictEqual(["module: one", "module: two"])
	})
})

describe("parsing change entries", function () {
	const emptyLine = ""
	const kv = (k, v) => `${k}: ${v}`

	const module = (x) => kv("module", x)
	const type = (x) => kv("type", x)
	const description = (x) => kv("description", x)
	const note = (x) => kv("note", x)

	const doc = (...ss) => ss.join("\n") // assemble kv pairs together

	const pr: PullRequest = {
		url: "https://github.com/owner/repo/pulls/13",
		title: "Shmoo", // should not be used
		number: 13,
		state: "",
		body: "",
		milestone: { title: "v1.23.456", number: 2 },
	}

	const cases: {
		title: string
		pr: PullRequest
		input: string[]
		want?: Array<ChangeEntry | { pull_request: string }>
	}[] = [
		{
			title: "parses minimal input",
			pr,
			input: [
				doc(
					//
					module("mod"),
					type("fix"),
					description("something was done"),
				),
			],
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
			input: [
				doc(
					//
					module("multiline"),
					type("fix"),
					description(
						doc(
							//
							"|",
							"  something was done:",
							emptyLine,
							"  parses input with colons in values",
						),
					),
				),
			],
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
			input: [
				doc(
					//
					module("modname"),
					type("fix"),
					description("something was done"),
					note("parses note field"),
				),
			],
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
			input: [
				doc(
					emptyLine,
					module("modname"),
					emptyLine,
					type("fix"),
					emptyLine,
					description("something was done"),
					emptyLine,
					note("we xpect some outage"),
					emptyLine,
				),
			],
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
			title: "parses multiple docs and preserves order",
			pr,
			input: [
				doc(
					//
					module("mod3"),
					type("fix"),
					description("modification3"),
				),
				doc(
					//
					module("mod1"),
					type("feature"),
					description("modification1"),
					note("with note"),
				),
				doc(
					//
					module("mod2"),
					type("fix"),
					description("modification2"),
				),
			],
			want: [
				new ChangeEntry({
					module: "mod3",
					type: "fix",
					description: "modification3",
					pull_request: pr.url,
				}),
				new ChangeEntry({
					module: "mod1",
					type: "feature",
					description: "modification1",
					note: "with note",
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
			input: [
				doc(
					//
					module("11"),
					type("fix"),
					description("-55"),
					note("42"),
				),
			],
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
			title: "parses empty fields as-is",
			pr,
			input: ["x: y"],
			want: [
				new ChangeEntry({
					module: "",
					type: "",
					description: "",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "parses malformed YAML",
			pr,
			input: ["mod: mod: mod:"],
			want: [
				new ChangeEntry({
					module: "",
					type: "",
					description: "",
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

	const expected = [changes1, changes2]

	return { input, expected }
}
