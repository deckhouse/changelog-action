import type { Config } from "@jest/types"

const config: Config.InitialOptions = {
	verbose: true,
	clearMocks: true,
	moduleFileExtensions: ["js", "ts"],
	testEnvironment: "node",
	testMatch: ["**/*.test.ts"],
	testRunner: "jest-circus/runner",
	transform: {
		"^.+\\.ts$": "ts-jest",
	},
}

export default config
