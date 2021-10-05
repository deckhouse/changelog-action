import * as yaml from "js-yaml"
import { ChangesByModule } from "./parse"

export function formatMarkdown(milestone: string, body: string): string {
	const header = `## Changelog ${milestone}`
	return [header, body].join("\r\n\r\n")
}
export function formatYaml(changesByModule: ChangesByModule): string {
	// TODO UNKNOWN should come first
	return yaml.dump(changesByModule, { sortKeys: true, lineWidth: 100 })
}
