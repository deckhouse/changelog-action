import { formatMarkdown, formatYaml } from "../src/format"
import { ChangeEntry } from "../src/parse"
import * as fs from "fs"

const changes: ChangeEntry[] = [
	// missing high impact detail, missing type
	new ChangeEntry({
		section: "yyy",
		type: "",
		summary: "dm2",
		pull_request: "https://github.com/ow/re/533",
		impact_level: "high",
	}),
	new ChangeEntry({
		section: "cloud-provider-yandex",
		type: "fix",
		summary: "d21",
		pull_request: "https://github.com/ow/re/210",
		impact_level: "high",
		impact: `Grafana will be restarted.
Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.`,
	}),
	new ChangeEntry({
		section: "chrony",
		type: "feature",
		summary: "d12",
		pull_request: "https://github.com/ow/re/120",
	}),
	new ChangeEntry({
		section: "cloud-provider-yandex",
		type: "feature",
		summary: "d22",
		pull_request: "https://github.com/ow/re/220",
	}),
	new ChangeEntry({
		section: "chrony",
		type: "fix",
		summary: "d11",
		pull_request: "https://github.com/ow/re/110",
	}),
	// invalid type
	new ChangeEntry({
		section: "xxx",
		type: "fix | feature",
		summary: "dm1",
		pull_request: "https://github.com/ow/re/510",
	}),
	new ChangeEntry({
		section: "kube-dns",
		type: "fix",
		summary: "d48",
		pull_request: "https://github.com/ow/re/480",
	}),
	new ChangeEntry({
		section: "cloud-provider-yandex",
		type: "fix",
		summary: "d29",
		pull_request: "https://github.com/ow/re/290",
	}),
	new ChangeEntry({
		section: "cloud-provider-yandex",
		type: "fix",
		summary: "d00029",
		pull_request: "https://github.com/ow/re/291",
		impact_level: "low",
	}),
	new ChangeEntry({
		section: "kube-dns",
		type: "feature",
		summary: "widlcard domains support",
		pull_request: "https://github.com/ow/re/491",
		impact: "So good.",
		impact_level: "high",
	}),
	// missing high impact detail
	new ChangeEntry({
		section: "kube-dns",
		type: "feature",
		summary: "impact missing",
		pull_request: "https://github.com/ow/re/495",
		impact_level: "high",
	}),
]

describe("Change validation", () => {
	const required = {
		section: "kube-dns",
		type: "feature",
		summary: "summary",
		pull_request: "https://github.com/ow/re/495",
	}
	const impact = "big deal"
	const impact_level = "high"

	const errMissingHighImpactDetail = "missing high impact detail"
	const errInvalidType = (t) => `invalid type "${t}"`
	const errMissing = (f) => `missing ${f}`

	const cases = [
		{
			title: "no errors when only required",
			opts: required,
			expected: [],
		},
		{
			title: "no errors when valid high impact",
			opts: { ...required, impact, impact_level },
			expected: [],
		},
		{
			title: "no errors when valid low with impact",
			opts: { ...required, impact, impact_level: "low" },
			expected: [],
		},
		{
			title: "no errors when valid low without impnact",
			opts: { ...required, impact_level: "low" },
			expected: [],
		},
		{
			title: "err missing high impact description",
			opts: { ...required, impact_level: "high" },
			expected: [errMissingHighImpactDetail],
		},
		{
			title: "err invalid type",
			opts: { ...required, type: "high" },
			expected: [errInvalidType("high")],
		},
		{
			title: "err invalid type",
			opts: { ...required, type: "" },
			expected: [errMissing("type")],
		},
		{
			title: "err invalid summary",
			opts: { ...required, summary: "" },
			expected: [errMissing("summary")],
		},
		{
			title: "err invalid section",
			opts: { ...required, section: "" },
			expected: [errMissing("section")],
		},
		{
			title: "errs sorted",
			opts: { ...required, type: "", impact_level: "high" },
			expected: [errMissingHighImpactDetail, errMissing("type")],
		},
	]
	test.each(cases)("$title", (c) => {
		expect(new ChangeEntry(c.opts).validate()).toStrictEqual(c.expected)
	})
})

describe("YAML", () => {
	const expectedYAML = fs.readFileSync("./test/fixtures/formatted/changelog.yml", { encoding: "utf-8" })

	test("formats right", () => {
		expect(formatYaml(changes)).toEqual(expectedYAML)
	})
})

describe("Markdown", () => {
	const milestone = "v3.44.555"
	const md = formatMarkdown(milestone, changes)

	// This markdown formatting is implementation-dependant. The test only check that everything
	// is in place.
	const expectedMarkdown = fs.readFileSync("./test/fixtures/formatted/changelog.md", { encoding: "utf-8" })

	test("has version title as h1", () => {
		const firstLine = md.split("\n")[0].trim()
		expect(firstLine).toBe(`# Changelog v3.44.555`)
	})

	test("formats type name as h2", () => {
		const subheaders = md
			.split("\n")
			.map((s) => s.trim())
			.filter((s) => s.startsWith("## "))

		expect(subheaders).toStrictEqual(["## [MALFORMED]", "## Release digest", "## Features", "## Fixes"])
	})

	test("formats right", () => {
		expect(md).toStrictEqual(expectedMarkdown)
	})
})

// describe("Partial Markdown", () => {
// 	const md = formatPartialMarkdown(changes)

// 	// This markdown formatting is implementation-dependant. The test only check that everything
// 	// is in place.
// 	const expected = `### Features

//  - **[chrony]** d12 [#120](https://github.com/ow/re/120)
//  - **[cloud-provider-yandex]** d22 [#220](https://github.com/ow/re/220)
//  - **[kube-dns]** widlcard domains support [#491](https://github.com/ow/re/491)
//     So good.

// ### Fixes

//  - **[chrony]** d11 [#110](https://github.com/ow/re/110)
//  - **[cloud-provider-yandex]** d21 [#210](https://github.com/ow/re/210)
//     Grafana will be restarted.
//     Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
//     Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.
//  - **[cloud-provider-yandex]** d29 [#290](https://github.com/ow/re/290)
//  - **[cloud-provider-yandex]** d00029 [#291](https://github.com/ow/re/291)
//  - **[kube-dns]** d48 [#480](https://github.com/ow/re/480)
// `
// 	test("does not have h1", () => {
// 		const headers = md.split("\n").filter((line) => line.startsWith("# "))
// 		expect(headers).toHaveLength(0)
// 	})

// 	test("does not have h2", () => {
// 		const subheaders = md.split("\n").filter((line) => line.startsWith("## "))
// 		expect(subheaders).toHaveLength(0)
// 	})

// 	test("formats sections as h3", () => {
// 		const subheaders = md
// 			.split("\n")
// 			.map((s) => s.trim())
// 			.filter((s) => s.startsWith("### "))

// 		expect(subheaders).toStrictEqual(["### Features", "### Fixes"])
// 	})

// 	test("formats right", () => {
// 		expect(md).toStrictEqual(expected)
// 	})
// })
