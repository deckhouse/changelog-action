import { MilestoneVersion } from "../src/changes"

describe("Milestone version", () => {
	const version = new MilestoneVersion("v1.85.3")

	test("'v' prefix is valid", () => {
		expect(version.isValid()).toBeTruthy()
	})

	test("no 'v' prefix is invalid", () => {
		expect(new MilestoneVersion("1.85.3").isValid()).toBeFalsy()
	})

	test("return minor", () => {
		expect(version.toMinor()).toEqual("v1.85")
	})

	test("backwards iteration", () => {
		expect(Array.from(version.downToZero())).toStrictEqual(["v1.85.2", "v1.85.1", "v1.85.0"])
	})
})
