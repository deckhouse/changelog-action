import { parsePullRequestChanges, PullRequest, PullRequestChange, extractChangesBlock } from "./parse"

describe("parsePullRequestChanges", function () {
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
			input: `
module: mod
type: fix
description: something was done
      `,
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
			input: `
module: multiline
type: fix
description: |
  something was done:

  parses input with colons in values

`,
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
			input: `
module: modname
type: fix
description: something was done
note: parses note field
      `,
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
			input: `

module: modname

type: fix

description: something was done

note: we xpect some outage

      `,
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
			input: `

module: mod1
type: fix
description: modification1
---
module: mod2
type: fix
description: modification2
      `,
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
			input: `

module: mod1
type: fix
description: modification1
---
x: y
---
module: mod2
type: fix
description: modification2
      `,
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
			input: `

module: mod1
type: fix
      `,
			want: [
				new PullRequestChange({
					module: "UNKNOWN",
					type: "unknown",
					description: `${pr.title} (#${pr.number})`,
					pull_request: pr.url,
				}),
			],
		},

		{
			title: "substitutes unknown type with `unknown`",
			pr,
			input: `

module: mod1
type: bigfix
description: pewpew
      `,
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
			input: `
type: fix
description: pewpew
      `,
			want: [
				new PullRequestChange({
					module: "UNKNOWN",
					type: "unknown",
					description: `${pr.title} (#${pr.number})`,
					pull_request: pr.url,
				}),
			],
		},
	]

	test.each(cases)("$title", function (c) {
		const change = parsePullRequestChanges(pr, c.input)
		expect(change).toStrictEqual(c.want)
	})
})

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
})
