import { ChangeEntry, ChangeEntryOpts, knownLevels } from "./parse"

export function getValidator(allowedSections: string[] = []): ValidatorImpl | NoopValidator {
	if (allowedSections.length === 0) {
		return new NoopValidator()
	}

	const m = parseConfig(allowedSections)
	return new ValidatorImpl(m)
}

export interface Validator {
	validate(c: ChangeEntry): ChangeEntry
}

class InvalidChangeEntry extends ChangeEntry {
	constructor(opts: ChangeEntryOpts, private extraErrors: string[]) {
		super(opts)
	}

	validate(): string[] {
		return [...super.validate(), ...this.extraErrors]
	}
}

export class ValidatorImpl implements Validator {
	// map: section -> forcedLevel
	constructor(private config: Map<string, string>) {}

	validate(c: ChangeEntry): ChangeEntry {
		if (!this.config.has(c.section)) {
			return new InvalidChangeEntry(c, [`unknown section "${c.section}"`])
		}

		const forcedLevel = this.config.get(c.section)
		if (forcedLevel && forcedLevel != c.impact_level) {
			const cc = new ChangeEntry(c)
			cc.impact_level = forcedLevel
			return cc
		}

		return c
	}
}

export class NoopValidator implements Validator {
	validate(c: ChangeEntry): ChangeEntry {
		return c
	}
}

export function parseConfig(definitions: string[]): Map<string, string> {
	const config = new Map()
	const invalid = new Set<string>()
	const duplicates = new Set<string>()

	for (const definition of definitions) {
		const parts = definition.split(":")

		// Check the definition is valid
		if (parts.length === 0 || parts.length > 2) {
			invalid.add(definition)
			continue
		}

		// Check we should overwrite or collect an error
		const [section, level = ""] = parts
		if (config.has(section)) {
			// If the level does not change that's duplicate. Otherwise, rewrite the
			// definition
			const curLevel = config.get(section)
			if (curLevel === level) {
				duplicates.add(section)
				continue
			}

			if (level === "") {
				// Ignore duplicate if it is not more specific than default
				continue
			}
		}

		if (parts.length === 1) {
			config.set(section, "")
			continue
		}

		if (parts.length === 2 && level && knownLevels.has(level)) {
			config.set(section, level)
			continue
		}
	}

	let err = ""
	if (invalid.size > 0) {
		err += `invalid section definitions: ${Array.from(invalid).join(", ")}`
	}
	if (duplicates.size > 0) {
		if (err != "") err += "\n"
		err += `duplicated sections in definitions: ${Array.from(duplicates).join(", ")}`
	}
	if (err.length > 0) {
		throw new Error(`invalid allowed_sections:\n${err}`)
	}

	return config
}
