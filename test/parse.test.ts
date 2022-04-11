import * as fs from "fs"
import * as path from "path"
import { Pull } from "../src/client"
import { NoopValidator } from "../src/validator"
import { ChangeEntry, collectChangelog, parseChangeEntries, parseChangesBlocks } from "./../src/parse"

describe("extracting raw changes", () => {
	function block(content: string, type = "") {
		const delim = "```"
		const start = delim + type
		const end = delim
		return [start, content, end].join("\n")
	}

	test("parses empty line on empty input", () => {
		expect(parseChangesBlocks("")).toStrictEqual([])
	})

	describe("v1", () => {
		test("parses single block", () => {
			const input = block("module: one", "changes")
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual(["module: one"])
		})

		test("ignores all blocks except frist one", () => {
			const input = [block("module: one", "changes"), block("module: two", "changes")].join("\n")

			const parsed = parseChangesBlocks(input)
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
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual(["module: one", "module: two"])
		})

		test("ignores blocks with malformed beginning", () => {
			const input = ["````changes", "module: one", "```"].join("\n")
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual([])
		})

		test("tolerates blocks with malformed ending due (the `marked` lib works so)", () => {
			const input = ["```changes", "module: one", "````"].join("\n")
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual(["module: one"])
		})

		test("parses two blocks from GitHub JSON", () => {
			const { input, expected } = getTwoBlocksBodyFixture()
			const parsed = parseChangesBlocks(input)
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
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual(["module: one", "module: two"])
		})
	})

	describe("v2", () => {
		test("parses single block", () => {
			const input = block("section: one", "changes")
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual(["section: one"])
		})

		test("ignores all blocks except frist one", () => {
			const input = [block("section: one", "changes"), block("section: two", "changes")].join("\n")

			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual(["section: one", "section: two"])
		})

		test("ignores non-changes blocks ", () => {
			const input = [
				block("nothing"),
				"",
				block("yaml", "yaml"),
				block("section: one", "changes"),
				block("shell", "shell"),
				"",
				block("section: two", "changes"),
				block("nothing2"),
			].join("\n")
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual(["section: one", "section: two"])
		})

		test("ignores blocks with malformed beginning", () => {
			const input = ["````changes", "section: one", "```"].join("\n")
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual([])
		})

		test("tolerates blocks with malformed ending due (the `marked` lib works so)", () => {
			const input = ["```changes", "section: one", "````"].join("\n")
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual(["section: one"])
		})

		test("parses two blocks from GitHub JSON", () => {
			const { input, expected } = getTwoBlocksBodyFixture()
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual(expected)
		})

		test("ignores HTML comments", () => {
			const input = [
				block("section: one", "changes"),
				"<!--",
				block("section: hidden", "changes"),
				"-->",
				block("section: two", "changes"),
			].join("\n")
			const parsed = parseChangesBlocks(input)
			expect(parsed).toStrictEqual(["section: one", "section: two"])
		})
	})
})

describe("parsing change entries", function () {
	const emptyLine = ""
	const kv = (k, v) => `${k}: ${v}`
	const doc = (...ss) => ss.join("\n") // assemble kv pairs together

	const type = (x) => kv("type", x)

	// v1
	const moduleField = (x) => kv("module", x)
	const descriptionField = (x) => kv("description", x)
	const noteField = (x) => kv("note", x)

	// v2
	const sectionField = (x) => kv("section", x)
	const summaryField = (x) => kv("summary", x)
	const impactField = (x) => kv("impact", x)
	const impactLevelField = (x) => kv("impact_level", x)

	const pr: Pull = {
		url: "https://github.com/owner/repo/pulls/13",
		title: "Shmoo", // should not be used
		number: 13,
		state: "",
		body: "",
		milestone: {
			title: "v1.23.456",
			number: 2,
			state: "closed",
		},
	}

	const getCases = (
		$mod: (x: string) => string,
		$desc: (x: string) => string,
		$note: (x: string) => string,
	): {
		title: string
		pr: Pull
		input: string[]
		want?: Array<ChangeEntry | { pull_request: string }>
	}[] => [
		{
			title: "parses minimal input",
			pr,
			input: [
				doc(
					//
					$mod("mod"),
					type("fix"),
					$desc("something was done"),
				),
			],
			want: [
				new ChangeEntry({
					section: "mod",
					type: "fix",
					summary: "something was done",
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
					$mod("multiline"),
					type("fix"),
					$desc(
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
					section: "multiline",
					type: "fix",
					summary: "something was done:\n\nparses input with colons in values",
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
					$mod("modname"),
					type("fix"),
					$desc("something was done"),
					$note("parses note field"),
				),
			],
			want: [
				new ChangeEntry({
					section: "modname",
					type: "fix",
					summary: "something was done",
					impact: "parses note field",
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
					$mod("modname"),
					emptyLine,
					type("fix"),
					emptyLine,
					$desc("something was done"),
					emptyLine,
					$note("we xpect some outage"),
					emptyLine,
				),
			],
			want: [
				new ChangeEntry({
					section: "modname",
					type: "fix",
					summary: "something was done",
					impact: "we xpect some outage",
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
					$mod("mod3"),
					type("fix"),
					$desc("modification3"),
				),
				doc(
					//
					$mod("mod1"),
					type("feature"),
					$desc("modification1"),
					$note("with note"),
				),
				doc(
					//
					$mod("mod2"),
					type("fix"),
					$desc("modification2"),
				),
			],
			want: [
				new ChangeEntry({
					section: "mod3",
					type: "fix",
					summary: "modification3",
					pull_request: pr.url,
				}),
				new ChangeEntry({
					section: "mod1",
					type: "feature",
					summary: "modification1",
					impact: "with note",
					pull_request: pr.url,
				}),
				new ChangeEntry({
					section: "mod2",
					type: "fix",
					summary: "modification2",
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
					$mod("11"),
					type("fix"),
					$desc("-55"),
					$note("42"),
				),
			],
			want: [
				new ChangeEntry({
					section: "11",
					type: "fix",
					summary: "-55",
					impact: "42",
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
					section: "",
					type: "",
					summary: "",
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
					section: "",
					type: "",
					summary: "",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "parses malformed YAML alogn with valid YAML",
			pr,
			input: ["mod: mod: mod:", "module: good"],
			want: [
				new ChangeEntry({
					section: "",
					type: "",
					summary: "",
					pull_request: pr.url,
				}),
				new ChangeEntry({
					section: "good",
					type: "",
					summary: "",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "parses empty YAML",
			pr,
			input: [""],
			want: [
				new ChangeEntry({
					section: "",
					type: "",
					summary: "",
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "parses zero input",
			pr,
			input: [],
			want: [],
		},
	]

	describe("v1", function () {
		const cases = getCases(moduleField, descriptionField, noteField)
		test.each(cases)("$title", function (c) {
			const change = parseChangeEntries(pr, c.input)
			expect(change).toStrictEqual(c.want)
		})
	})

	describe("v2", function () {
		const cases = getCases(sectionField, summaryField, impactField)
		test.each(cases)("$title", function (c) {
			const change = parseChangeEntries(pr, c.input)
			expect(change).toStrictEqual(c.want)
		})

		test("parses impact level", () => {
			const section = "section"
			const typ = "fix"
			const summary = "big deal"
			const impact = "changes much"
			const impactLevel = "high"

			const input = [
				doc(
					//
					sectionField(section),
					type(typ),
					summaryField(summary),
					impactField(impact),
					impactLevelField(impactLevel),
				),
			]
			const change = parseChangeEntries(pr, input)
			expect(change).toStrictEqual([
				new ChangeEntry({
					section,
					type: typ,
					summary,
					impact,
					impact_level: impactLevel,
					pull_request: pr.url,
				}),
			])
		})

		test(`parses absent impact level as "default"`, () => {
			const section = "section"
			const typ = "fix"
			const summary = "big deal"
			const impact = "changes much"
			const impactLevel = "default"

			const input = [
				doc(
					// doc 1
					sectionField(section),
					type(typ),
					summaryField(summary),
					impactField(impact),
					// omitted impact level
				),
				doc(
					// doc 2
					sectionField(section),
					type(typ),
					summaryField(summary),
					impactField(impact),
					impactLevelField(impactLevel), // explicit
				),
			]
			const change = parseChangeEntries(pr, input)
			const expectedChange = new ChangeEntry({
				section,
				type: typ,
				summary,
				impact,
				impact_level: impactLevel,
				pull_request: pr.url,
			})
			expect(change).toStrictEqual([expectedChange, expectedChange])
		})
	})
})

describe("Parsing pulls", () => {
	const pulls = getPulls()
	const changes = collectChangelog(pulls, new NoopValidator())

	it("contains all changes", () => {
		expect(changes).toHaveLength(57)
	})

	test.each(changes)("$pull_request", function (c) {
		expect(c.valid()).toBeTruthy()
	})

	describe("#353", () => {
		const expectedBlock = `module: dhctl
type: feature
description: "Control plane readiness check before control plane node converging"
---
module: deckhouse
type: feature
description: "Add node affinity in deckhouse deployment for evicting pod from converging node"
note: "Node with label 'dhctl.deckhouse.io/node-for-converge' exclude from scheduling deckhouse pod"`

		it("parses the changes from PR body", () => {
			const p = pulls.find((p) => p.number === 353)
			const changeBlocks = parseChangesBlocks(p.body)
			expect(changeBlocks).toHaveLength(1)
			expect(changeBlocks).toStrictEqual([expectedBlock])
		})

		it("contains all changes", () => {
			const c353 = changes.filter((c) => c.pull_request.endsWith("/353"))
			expect(c353).toHaveLength(2)
		})
	})
})

function readFixture(name: string) {
	return fs.readFileSync(path.join("./test/fixtures", name), { encoding: "utf8" })
}

function getTwoBlocksBodyFixture() {
	const bodyFile = "pr_body_2_blocks.json"
	const changeFile1 = "pr_body_2_blocks_change_1.yml"
	const changeFile2 = "pr_body_2_blocks_change_2.yml"

	const input = JSON.parse(readFixture(bodyFile)).body
	const changes1 = readFixture(changeFile1)
	const changes2 = readFixture(changeFile2)

	const expected = [changes1, changes2]

	return { input, expected }
}

function getPulls() {
	return require("./fixtures/pulls-v1.31.0.json")
}
