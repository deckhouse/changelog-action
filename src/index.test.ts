import { expect } from "chai"
//*
describe("Function", function () {
	describe("parseSingleChange", function () {
		const pr = {
			url: "https://github.com/owner/repo/pulls/13",
			title: "Shmoo",
			number: "13",
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
				want: {
					module: "mod",
					type: "fix",
					description: "something was done",
					pull_request: pr.url,
				},
			},

			{
				title: "parses input with colons in values",
				pr,
				input: `
      module: mod:tech
      type: fix
      description: something was done: nobody knownhs what
      `,
				want: {
					module: "mod:tech",
					type: "fix",
					description: "something was done: nobody knownhs what",
					pull_request: pr.url,
				},
			},

			{
				title: "parses note field",
				pr,
				input: `
      module: modname
      type: fix
      description: something was done
      note: we xpect some outage
      `,
				want: {
					module: "modname",
					type: "fix",
					description: "something was done",
					note: "we xpect some outage",
					pull_request: pr.url,
				},
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
				want: {
					module: "modname",
					type: "fix",
					description: "something was done",
					note: "we xpect some outage",
					pull_request: pr.url,
				},
			},

			{
				title: "falls back when meets malformed input ",
				pr,
				input: `
      - module: modname
        type: fix
        description: something was done
        note: we xpect some outage
      `,
				want: {
					module: "unknown",
					type: "UNKNOWN",
					description: `${pr.title} (#${pr.number})`,
					pull_request: pr.url,
				},
			},
		]

		cases.forEach((c) =>
			it(c.title, function () {
				const change = parseSingleChange(pr, c.input)
				expect(change).to.deep.eq(c.want)
			}),
		)
	})

	describe("parseChanges", function () {
		const pr = {
			number: "43",
			url: "https://github.com/owner/repo/pulls/43",
			title: "Zoo",
			body: "```changes\n\rmodule:zzoooo\n\rtype:fix\n\rdescription:d\n\r```",
		}

		it("parses input with given parser", function () {
			const parsed = new Change({
				module: "parsed",
				type: "parsed",
				description: "parsed",
				pull_request: pr.url,
			})

			const fallbacked = new Change({
				module: "fallback",
				type: "fallback",
				description: "fallback",
				pull_request: pr.url,
			})

			const changes = parseChanges(
				pr,
				() => parsed,
				() => fallbacked,
			)
			expect(changes).to.deep.eq([parsed])
		})
		it("falls back when pr body does not contain `changes` block")
		it("falls back when at least of one change is invalid")
		it("falls back when no changes parsed")
	})

	describe("fallbackChange", function () {
		it("creates with required args", function () {
			const data = {
				module: "m",
				type: "t",
				description: "d",
				pull_request: "p",
			}
			const ch = new Change(data)

			expect(ch).to.deep.eq(data)
		})
	})
})

/**/
