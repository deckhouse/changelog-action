import { formatYaml, formatMarkdown } from "./format"
import { Change, ChangesByModule } from "./parse"

const changes: ChangesByModule = {
	one: {
		fixes: [new Change({ description: "d11", pull_request: "pr11" })],
		features: [new Change({ description: "d12", pull_request: "pr12" })],
		unknown: [new Change({ description: "d1u", pull_request: "pr1u" })],
	},
	two: {
		fixes: [new Change({ description: "d21", pull_request: "pr21", note: "Big news" })],
		features: [new Change({ description: "d22", pull_request: "pr22" })],
		unknown: [new Change({ description: "d2u", pull_request: "pr2u" })],
	},
	UNKNOWN: {
		fixes: [new Change({ description: "du1", pull_request: "pru1" })],
		features: [new Change({ description: "du2", pull_request: "pru2" })],
		unknown: [new Change({ description: "duu", pull_request: "pruu" })],
	},
}

describe("YAML", () => {
	const expected = `UNKNOWN:
  unknown:
    - description: duu
      pull_request: pruu
  features:
    - description: du2
      pull_request: pru2
  fixes:
    - description: du1
      pull_request: pru1
one:
  unknown:
    - description: d1u
      pull_request: pr1u
  features:
    - description: d12
      pull_request: pr12
  fixes:
    - description: d11
      pull_request: pr11
two:
  unknown:
    - description: d2u
      pull_request: pr2u
  features:
    - description: d22
      pull_request: pr22
  fixes:
    - description: d21
      note: Big news
      pull_request: pr21
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
	const expected = `## Changelog v3.44.555

#### [UNKNOWN]

 - unknown
     - duu
         - [Pull request](pruu)
 - features
     - du2
         - [Pull request](pru2)
 - fixes
     - du1
         - [Pull request](pru1)

#### [one]

 - unknown
     - d1u
         - [Pull request](pr1u)
 - features
     - d12
         - [Pull request](pr12)
 - fixes
     - d11
         - [Pull request](pr11)

#### [two]

 - unknown
     - d2u
         - [Pull request](pr2u)
 - features
     - d22
         - [Pull request](pr22)
 - fixes
     - d21
         - [Pull request](pr21)
         - **NOTE!** Big news
`
	test("has milestone header as h2", () => {
		const firstLine = md.split("\n")[0].trim()
		expect(firstLine).toBe(`## Changelog v3.44.555`)
	})

	test("formats module name as h4 in square brackets", () => {
		const subheaders = md
			.split("\n")
			.map((s) => s.trim())
			.filter((s) => s.startsWith("###"))

		expect(subheaders).toStrictEqual(["#### [UNKNOWN]", "#### [one]", "#### [two]"])
	})

	test("formats right", () => {
		expect(md).toBe(expected)
	})
})
