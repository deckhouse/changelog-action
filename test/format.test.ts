import { formatMarkdown, formatYaml } from "../src/format"
import { ChangeEntry } from "../src/parse"

const changes: ChangeEntry[] = [
	new ChangeEntry({ module: "yyy", type: "", description: "dm2", pull_request: "prm2" }),
	new ChangeEntry({ module: "two", type: "fix", description: "d21", pull_request: "pr21", note: "x" }),
	new ChangeEntry({ module: "one", type: "feature", description: "d12", pull_request: "pr12" }),
	new ChangeEntry({ module: "two", type: "feature", description: "d22", pull_request: "pr22" }),
	new ChangeEntry({ module: "one", type: "fix", description: "d11", pull_request: "pr11" }),
	new ChangeEntry({ module: "xxx", type: "", description: "dm1", pull_request: "prm1" }),
	new ChangeEntry({ module: "two", type: "fix", description: "d28", pull_request: "pr28" }),
	new ChangeEntry({ module: "two", type: "fix", description: "d29", pull_request: "pr29" }),
]

describe("YAML", () => {
	const expected = `one:
  features:
    - description: d12
      pull_request: pr12
  fixes:
    - description: d11
      pull_request: pr11
two:
  features:
    - description: d22
      pull_request: pr22
  fixes:
    - description: d21
      note: x
      pull_request: pr21
    - description: d28
      pull_request: pr28
    - description: d29
      pull_request: pr29
`
	test("formats right", () => {
		expect(formatYaml(changes)).toEqual(expected)
	})
})

describe("Markdown", () => {
	const milestone = "v3.44.555"
	const md = formatMarkdown(milestone, changes)

	// This markdown formatting is implementation-dependant. The test only check that everything
	// is in place.
	const expected = `# Changelog v3.44.555

## [MALFORMED]

 - [#prm1](prm1)
 - [#prm2](prm2)

## Features

 - **[one]** d12 [#pr12](pr12)
 - **[two]** d22 [#pr22](pr22)

## Fixes

 - **[one]** d11 [#pr11](pr11)
 - **[two]** d21 [#pr21](pr21)
    **NOTE!** x
 - **[two]** d28 [#pr28](pr28)
 - **[two]** d29 [#pr29](pr29)
`
	test("has milestone title as h1", () => {
		const firstLine = md.split("\n")[0].trim()
		expect(firstLine).toBe(`# Changelog v3.44.555`)
	})

	test("formats type name as h2", () => {
		const subheaders = md
			.split("\n")
			.map((s) => s.trim())
			.filter((s) => s.startsWith("## "))

		expect(subheaders).toStrictEqual(["## [MALFORMED]", "## Features", "## Fixes"])
	})

	test("formats right", () => {
		expect(md).toStrictEqual(expected)
	})
})
