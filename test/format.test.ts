import { formatMarkdown, formatYaml } from "../src/format"
import { ChangeEntry } from "../src/parse"

const changes: ChangeEntry[] = [
	new ChangeEntry({
		module: "yyy",
		type: "",
		description: "dm2",
		pull_request: "https://github.com/ow/re/533",
	}),
	new ChangeEntry({
		module: "cloud-provider-yandex",
		type: "fix",
		description: "d21",
		pull_request: "https://github.com/ow/re/210",
		note: `Grafana will be restarted.
Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.`,
	}),
	new ChangeEntry({
		module: "chrony",
		type: "feature",
		description: "d12",
		pull_request: "https://github.com/ow/re/120",
	}),
	new ChangeEntry({
		module: "cloud-provider-yandex",
		type: "feature",
		description: "d22",
		pull_request: "https://github.com/ow/re/220",
	}),
	new ChangeEntry({
		module: "chrony",
		type: "fix",
		description: "d11",
		pull_request: "https://github.com/ow/re/110",
	}),
	new ChangeEntry({
		module: "xxx",
		type: "",
		description: "dm1",
		pull_request: "https://github.com/ow/re/510",
	}),
	new ChangeEntry({
		module: "kube-dns",
		type: "fix",
		description: "d48",
		pull_request: "https://github.com/ow/re/480",
	}),
	new ChangeEntry({
		module: "cloud-provider-yandex",
		type: "fix",
		description: "d29",
		pull_request: "https://github.com/ow/re/290",
	}),
]

describe("YAML", () => {
	const expected = `chrony:
  features:
    - summary: d12
      pull_request: https://github.com/ow/re/120
  fixes:
    - summary: d11
      pull_request: https://github.com/ow/re/110
cloud-provider-yandex:
  features:
    - summary: d22
      pull_request: https://github.com/ow/re/220
  fixes:
    - summary: d21
      pull_request: https://github.com/ow/re/210
      impact: >-
        Grafana will be restarted.

        Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached),
        because direct(browse) datasources type is depreated now. And alerts don't work with direct
        data sources.

        Provisioning datasources from secret instead configmap. Deckhouse datasources need client
        certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while
        terminating.
    - summary: d29
      pull_request: https://github.com/ow/re/290
kube-dns:
  fixes:
    - summary: d48
      pull_request: https://github.com/ow/re/480
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


 - #510
 - #533

## Features


 - **[chrony]** d12 [#120](https://github.com/ow/re/120)
 - **[cloud-provider-yandex]** d22 [#220](https://github.com/ow/re/220)

## Fixes


 - **[chrony]** d11 [#110](https://github.com/ow/re/110)
 - **[cloud-provider-yandex]** d21 [#210](https://github.com/ow/re/210)
    Grafana will be restarted.
    Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
    Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.
 - **[cloud-provider-yandex]** d29 [#290](https://github.com/ow/re/290)
 - **[kube-dns]** d48 [#480](https://github.com/ow/re/480)
`
	test("has chrony title as h1", () => {
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
