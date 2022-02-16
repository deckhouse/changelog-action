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

function parseConfig(sections: string[]) {
	const m = new Map()
	const invalid = new Set<string>()
	const duplicates = new Set<string>()

	for (const definition of sections) {
		const parts = definition.split(":")

		if (parts.length === 0 || parts.length > 2) {
			invalid.add(definition)
			continue
		}

		const [section, level] = parts
		if (m.has(section)) {
			duplicates.add(section)
			continue
		}

		if (parts.length === 1) {
			m.set(section, "")
			continue
		}

		if (parts.length === 2 && level && knownLevels.has(level)) {
			m.set(section, level)
			continue
		}
	}

	let err = ""
	if (invalid.size > 0) {
		err += `invalid section definitions: ${Array.from(invalid).join(", ")}`
	}
	if (duplicates.size > 0) {
		err += `\nduplicated sections in definitions: ${Array.from(duplicates).join(", ")}`
	}
	if (err.length > 0) {
		throw new Error(`invalid allowed_sections:\n${err}`)
	}

	return m
}
