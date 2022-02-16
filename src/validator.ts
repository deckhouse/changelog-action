import { ChangeEntry, ChangeEntryOpts } from "./parse"

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
	for (const s of sections) {
		const parts = s.split(":")
		const [section, level] = parts

		switch (parts.length) {
			case 0:
				throw new Error(`invalid allowed_sections config: "${sections}"`)
			case 1:
				m.set(section, "")
				break
			case 2:
				m.set(section, level)
				break
			default:
				throw new Error(`unexpected section notation in allowed_sections config: "${s}"`)
		}
	}
	return m
}
