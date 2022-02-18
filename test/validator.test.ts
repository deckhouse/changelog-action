import { ChangeEntry, LEVEL_HIGH, LEVEL_LOW } from "../src/parse"
import { getValidator, parseConfig } from "../src/validator"

describe("Getting validator", () => {
	const opts = {
		pull_request: "https://github.com/apapa/apepe/14",
		section: "big-mod",
		summary: "Significant changes",
		type: "feature",
		impact: "too many of them",
		impact_level: "high",
	}

	test("no config no validation", () => {
		const val = getValidator([])

		const c = new ChangeEntry(opts)

		expect(val.validate(c)).toStrictEqual(c)
	})

	test("allows specified sections", () => {
		const val = getValidator(["big-mod"])

		const c = new ChangeEntry(opts)

		expect(val.validate(c)).toStrictEqual(c)
	})

	test("invalidated unspecified sections", () => {
		const val = getValidator(["large-mod"])
		const c = new ChangeEntry(opts)

		const validated = val.validate(c)

		expect(validated).not.toStrictEqual(c)
		expect(validated.validate()).toStrictEqual([`unknown section "${opts.section}"`])
	})

	test("forcing impact", () => {
		const val = getValidator(["big-mod:low"])
		const c = new ChangeEntry(opts)

		const shrinked = new ChangeEntry({ ...opts, impact_level: LEVEL_LOW })

		expect(val.validate(c)).toStrictEqual(shrinked)
	})

	describe("Accepting multiple sections", () => {
		const val = getValidator(["coolmodule:high", "basicmodule", "dummy-mod:low"])

		test("invalidating unknown section", () => {
			const unknown = new ChangeEntry(opts)

			const validatedUnknown = val.validate(unknown)

			expect(validatedUnknown).not.toStrictEqual(unknown)
			expect(validatedUnknown.validate()).toStrictEqual([`unknown section "${opts.section}"`])
			expect(unknown.valid()).toBeTruthy()
			expect(validatedUnknown.valid()).toBeFalsy
		})

		test("changes level to high", () => {
			const high = new ChangeEntry({ ...opts, section: "coolmodule", impact_level: "" })

			const validatedHigh = val.validate(high)

			expect(validatedHigh).not.toStrictEqual(high)
			expect(validatedHigh.impact_level).toEqual(LEVEL_HIGH)
			expect(validatedHigh.valid()).toBeTruthy()
		})

		test("changes level to low", () => {
			const low = new ChangeEntry({ ...opts, section: "dummy-mod", impact_level: "" })

			const validatedLow = val.validate(low)

			expect(validatedLow).not.toStrictEqual(low)
			expect(validatedLow.impact_level).toEqual(LEVEL_LOW)
			expect(validatedLow.valid()).toBeTruthy()
		})

		test("does not modify level when not specified", () => {
			const untouched = new ChangeEntry({
				...opts,
				section: "basicmodule",
				impact_level: LEVEL_HIGH,
			})

			const validatedUntouched = val.validate(untouched)

			expect(validatedUntouched).toStrictEqual(untouched)
			expect(untouched).toBeTruthy()
		})
	})
})

describe("parsing list arg", () => {
	test("parses different values strings", () => {
		const input = ["a", "b:low", "c"]
		const expected = new Map([
			["a", ""],
			["b", "low"],
			["c", ""],
		])
		expect(parseConfig(input)).toStrictEqual(expected)
	})

	test("complains on duplicates", () => {
		const input = ["a", "b:low", "c", "a"]

		expect(() => parseConfig(input)).toThrow(/duplicate/)
	})

	test("compains on invalid definition schema", () => {
		const input = ["a", "b:low:bow", "c", "a"]

		expect(() => parseConfig(input)).toThrow(/invalid/)
	})

	test("on duplicates with modifier accept more specific definition", () => {
		const input = ["a", "b:low", "c", "a:low"]
		const expected = new Map([
			["a", "low"],
			["b", "low"],
			["c", ""],
		])

		expect(parseConfig(input)).toStrictEqual(expected)
	})

	test("on duplicates with modifier accepts more specific definition if it comes before less specific", () => {
		const input = ["a:low", "b:low", "c", "a"]
		const expected = new Map([
			["a", "low"],
			["b", "low"],
			["c", ""],
		])

		expect(parseConfig(input)).toStrictEqual(expected)
	})
})
