import { formatYaml, formatMarkdown } from "./format"
import { Change, ChangesByModule } from "./parse"

describe("YAML", () => {
	const changes: ChangesByModule = {
		one: {
			fixes: [new Change({ description: "d11", pull_request: "pr11" })],
			features: [new Change({ description: "d12", pull_request: "pr12" })],
			unknown: [new Change({ description: "d1u", pull_request: "pr1u" })],
		},
		two: {
			fixes: [new Change({ description: "d21", pull_request: "pr21" })],
			features: [new Change({ description: "d22", pull_request: "pr22" })],
			unknown: [new Change({ description: "d2u", pull_request: "pr2u" })],
		},
		UNKNOWN: {
			fixes: [new Change({ description: "du1", pull_request: "pru1" })],
			features: [new Change({ description: "du2", pull_request: "pru2" })],
			unknown: [new Change({ description: "duu", pull_request: "pruu" })],
		},
	}

	test("places UNKNOWNs on the top", () => {
		const expected = `
UNKNOWN:
  unknown:
    - description: duu
      pull_request: pruu
  fixes:
    - description: du1
      pull_request: pru1
  features:
    - description: du2
      pull_request: pru2
one:
  unknown:
    - description: d1u
      pull_request: pr1u
  fixes:
    - description: d11
      pull_request: pr11
  features:
    - description: d12
      pull_request: pr12
two:
  unknown:
    - description: d2u
      pull_request: pr2u
  fixes:
    - description: d21
      pull_request: pr21
  features:
    - description: d22
      pull_request: pr22
`
		expect(formatYaml(changes)).toEqual(expected.replace("\n", ""))
	})
})

describe("Markdown", () => {
	test.todo("has milestone header")
	test.todo("shows modules as sub-headers")
})
