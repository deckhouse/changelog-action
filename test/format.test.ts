import * as fs from "fs"
import * as yaml from "js-yaml"
import { formatMarkdown, formatYaml } from "../src/format"
import { ChangeEntry } from "../src/parse"

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
		impact_level: "default",
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
		section: "upmeter",
		type: "chore",
		summary: "Specify user-agent",
		pull_request: "https://github.com/ow/re/501",
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
			title: "no errors when valid low level with impact",
			opts: { ...required, impact, impact_level: "low" },
			expected: [],
		},
		{
			title: "no errors when valid low level without impact",
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

type YamlModule = {
	features?: Array<{ summary: string; pull_request: string; impact?: string }>
	fixes?: Array<{ summary: string; pull_request: string; impact?: string }>
}

describe("YAML deduplication", () => {
	test("merges duplicate fixes with same section, summary, and impact; keeps smaller PR number", () => {
		const list = [
			new ChangeEntry({
				section: "alpha",
				type: "fix",
				summary: "duplicate fix text",
				pull_request: "https://github.com/ow/re/900",
				impact_level: "low",
			}),
			new ChangeEntry({
				section: "alpha",
				type: "fix",
				summary: "duplicate fix text",
				pull_request: "https://github.com/ow/re/100",
				impact_level: "low",
			}),
		]
		const doc = yaml.load(formatYaml(list)) as Record<string, YamlModule>
		expect(doc.alpha.fixes).toHaveLength(1)
		expect(doc.alpha.fixes![0].pull_request).toBe("https://github.com/ow/re/100")
		expect(doc.alpha.fixes![0].summary).toBe("duplicate fix text")
	})

	test("merges duplicate features the same way", () => {
		const list = [
			new ChangeEntry({
				section: "beta",
				type: "feature",
				summary: "same feature",
				pull_request: "https://github.com/ow/re/50",
				impact_level: "default",
			}),
			new ChangeEntry({
				section: "beta",
				type: "feature",
				summary: "same feature",
				pull_request: "https://github.com/ow/re/10",
				impact_level: "default",
			}),
		]
		const doc = yaml.load(formatYaml(list)) as Record<string, YamlModule>
		expect(doc.beta.features).toHaveLength(1)
		expect(doc.beta.features![0].pull_request).toBe("https://github.com/ow/re/10")
	})

	test("prefers non-backport summary over Backport: … for the same normalized text", () => {
		const list = [
			new ChangeEntry({
				section: "gamma",
				type: "fix",
				summary: "Backport: shared description",
				pull_request: "https://github.com/ow/re/1",
				impact_level: "low",
			}),
			new ChangeEntry({
				section: "gamma",
				type: "fix",
				summary: "shared description",
				pull_request: "https://github.com/ow/re/999",
				impact_level: "low",
			}),
		]
		const doc = yaml.load(formatYaml(list)) as Record<string, YamlModule>
		expect(doc.gamma.fixes).toHaveLength(1)
		expect(doc.gamma.fixes![0].summary).toBe("shared description")
		expect(doc.gamma.fixes![0].pull_request).toBe("https://github.com/ow/re/999")
	})

	test("does not merge same summary in different sections", () => {
		const list = [
			new ChangeEntry({
				section: "m-a",
				type: "fix",
				summary: "shared",
				pull_request: "https://github.com/ow/re/1",
				impact_level: "low",
			}),
			new ChangeEntry({
				section: "m-b",
				type: "fix",
				summary: "shared",
				pull_request: "https://github.com/ow/re/2",
				impact_level: "low",
			}),
		]
		const doc = yaml.load(formatYaml(list)) as Record<string, YamlModule>
		expect(doc["m-a"].fixes).toHaveLength(1)
		expect(doc["m-b"].fixes).toHaveLength(1)
		expect(doc["m-a"].fixes![0].pull_request).not.toBe(doc["m-b"].fixes![0].pull_request)
	})

	test("does not merge fix and feature with the same summary in one section", () => {
		const list = [
			new ChangeEntry({
				section: "delta",
				type: "fix",
				summary: "same line",
				pull_request: "https://github.com/ow/re/1",
				impact_level: "low",
			}),
			new ChangeEntry({
				section: "delta",
				type: "feature",
				summary: "same line",
				pull_request: "https://github.com/ow/re/2",
				impact_level: "default",
			}),
		]
		const doc = yaml.load(formatYaml(list)) as Record<string, YamlModule>
		expect(doc.delta.fixes).toHaveLength(1)
		expect(doc.delta.features).toHaveLength(1)
	})

	test("does not merge when impact text differs", () => {
		const list = [
			new ChangeEntry({
				section: "eps",
				type: "fix",
				summary: "same summary",
				pull_request: "https://github.com/ow/re/1",
				impact_level: "high",
				impact: "first impact",
			}),
			new ChangeEntry({
				section: "eps",
				type: "fix",
				summary: "same summary",
				pull_request: "https://github.com/ow/re/2",
				impact_level: "high",
				impact: "second impact",
			}),
		]
		const doc = yaml.load(formatYaml(list)) as Record<string, YamlModule>
		expect(doc.eps.fixes).toHaveLength(2)
	})
})

describe("Markdown", () => {
	const milestone = "v3.44.555"
	const md = formatMarkdown(milestone, changes)

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

		expect(subheaders).toStrictEqual([
			"## [MALFORMED]",
			"## Know before update",
			"## Features",
			"## Fixes",
			"## Chore",
		])
	})

	test("formats right", () => {
		expect(md).toStrictEqual(expectedMarkdown)
	})
})

function markdownSection(md: string, heading: string): string {
	const marker = `## ${heading}\n`
	const start = md.indexOf(marker)
	if (start === -1) {
		throw new Error(`missing section ## ${heading}`)
	}
	const from = start + marker.length
	const tail = md.slice(from)
	const nextH2 = tail.search(/\n## /)
	return nextH2 === -1 ? tail : tail.slice(0, nextH2)
}

/** Top-level list rows in changelog markdown (module/PR lines), not continuation indentation. */
function moduleBulletLines(section: string): string[] {
	return section.split("\n").filter((l) => /^\s*-\s+\*\*\[/.test(l))
}

describe("Markdown deduplication", () => {
	const milestone = "v9.9.9"

	test("collapses duplicate fix rows when rendered line is identical", () => {
		const pr = "https://github.com/ow/re/18446"
		const dup = [
			new ChangeEntry({
				section: "cloud-provider-dvp",
				type: "fix",
				summary: "fix CVEs in cloud-provider-dvp",
				pull_request: pr,
				impact_level: "default",
			}),
			new ChangeEntry({
				section: "cloud-provider-dvp",
				type: "fix",
				summary: "fix CVEs in cloud-provider-dvp",
				pull_request: pr,
				impact_level: "default",
			}),
		]
		const md = formatMarkdown(milestone, dup)
		const fixes = markdownSection(md, "Fixes")
		const bullets = moduleBulletLines(fixes)
		expect(bullets).toHaveLength(1)
		expect(bullets[0]).toContain("cloud-provider-dvp")
		expect(bullets[0]).toContain("#18446")
	})

	test("collapses Backport and mainline when normalized summary matches", () => {
		const entries = [
			new ChangeEntry({
				section: "cloud-provider-dvp",
				type: "fix",
				summary: "Backport: fix CVEs in cloud-provider-dvp",
				pull_request: "https://github.com/ow/re/18446",
				impact_level: "default",
			}),
			new ChangeEntry({
				section: "cloud-provider-dvp",
				type: "fix",
				summary: "fix CVEs in cloud-provider-dvp",
				pull_request: "https://github.com/ow/re/18258",
				impact_level: "default",
			}),
			new ChangeEntry({
				section: "cloud-provider-zvirt",
				type: "feature",
				summary: "Backport: add customNetworkConfig",
				pull_request: "https://github.com/ow/re/18227",
				impact_level: "default",
			}),
			new ChangeEntry({
				section: "cloud-provider-zvirt",
				type: "feature",
				summary: "add customNetworkConfig",
				pull_request: "https://github.com/ow/re/17879",
				impact_level: "default",
			}),
		]
		const md = formatMarkdown(milestone, entries)
		const fixes = moduleBulletLines(markdownSection(md, "Fixes"))
		const features = moduleBulletLines(markdownSection(md, "Features"))
		expect(fixes).toHaveLength(1)
		expect(features).toHaveLength(1)
		// Prefer non-Backport summary and lower PR when choosing the kept row
		expect(fixes[0]).toContain("fix CVEs in cloud-provider-dvp")
		expect(fixes[0]).not.toMatch(/Backport:/i)
		expect(fixes[0]).toContain("[#18258](https://github.com/ow/re/18258)")
		expect(fixes[0]).not.toContain("18446")
		expect(features[0]).toContain("add customNetworkConfig")
		expect(features[0]).not.toMatch(/Backport:/i)
		expect(features[0]).toContain("[#17879](https://github.com/ow/re/17879)")
		expect(features[0]).not.toContain("18227")
	})

	test("merged duplicate descriptions link the smallest PR number", () => {
		const summary = "same change text"
		const entries = [
			new ChangeEntry({
				section: "mod",
				type: "fix",
				summary,
				pull_request: "https://github.com/ow/re/18349",
				impact_level: "default",
			}),
			new ChangeEntry({
				section: "mod",
				type: "fix",
				summary,
				pull_request: "https://github.com/ow/re/18350",
				impact_level: "default",
			}),
			new ChangeEntry({
				section: "mod",
				type: "fix",
				summary,
				pull_request: "https://github.com/ow/re/18355",
				impact_level: "default",
			}),
			new ChangeEntry({
				section: "mod",
				type: "fix",
				summary,
				pull_request: "https://github.com/ow/re/18348",
				impact_level: "default",
			}),
		]
		const md = formatMarkdown(milestone, entries)
		const fixes = moduleBulletLines(markdownSection(md, "Fixes"))
		expect(fixes).toHaveLength(1)
		expect(fixes[0]).toContain("[#18348](https://github.com/ow/re/18348)")
		expect(fixes[0]).not.toContain("18349")
		expect(fixes[0]).not.toContain("18350")
		expect(fixes[0]).not.toContain("18355")
	})

	test("keeps separate rows when normalized summary text differs", () => {
		const entries = [
			new ChangeEntry({
				section: "cloud-provider-dvp",
				type: "fix",
				summary: "fix CVEs in cloud-provider-dvp",
				pull_request: "https://github.com/ow/re/18258",
				impact_level: "default",
			}),
			new ChangeEntry({
				section: "cloud-provider-dvp",
				type: "fix",
				summary: "fix unrelated bug in cloud-provider-dvp",
				pull_request: "https://github.com/ow/re/18259",
				impact_level: "default",
			}),
		]
		const md = formatMarkdown(milestone, entries)
		expect(moduleBulletLines(markdownSection(md, "Fixes"))).toHaveLength(2)
	})
})
