import * as yaml from "js-yaml"
import { ChangesByModule } from "./parse"

export function formatMarkdown(milestone: string, body: ChangesByModule): string {
	const header = `## Changelog ${milestone}`
	return [header, formatYaml(body)].join("\r\n\r\n")
}
export function formatYaml(body: ChangesByModule): string {
	// TODO 'UNKNOWN' module should come first to highlight errors: `sortKeys` can be a function
	const opts = {
		sortKeys: true,
		lineWidth: 100,
		forceQuotes: false,
		quotingType: "'",
	} as yaml.DumpOptions

	return yaml.dump(body, opts)
}
