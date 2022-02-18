import { parseList } from "../src"

describe("parsing list arg", () => {
	test("parses newline-separated strings", () => {
		const input = ["a", "b:low", "c"].join("\n")
		expect(parseList(input)).toStrictEqual(["a", "b:low", "c"])
	})

	test("parses comma-separated strings", () => {
		const input = ["a", "b:low", "c"].join(",")
		expect(parseList(input)).toStrictEqual(["a", "b:low", "c"])
	})

	test("parses whitespace-separated strings", () => {
		const input = ["a", "b:low", "c"].join(" ")
		expect(parseList(input)).toStrictEqual(["a", "b:low", "c"])
	})

	test("parses mixed-separated strings", () => {
		const input = `
                ci:low
                testing:low
        vpa hpa,pma`
		expect(parseList(input)).toStrictEqual(["ci:low", "testing:low", "vpa", "hpa", "pma"])
	})
})
