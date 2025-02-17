import { parseChangeEntries, parseChangesBlocks } from "./parse";
import { getValidator } from "./validator";
import * as core from "@actions/core"

export async function checkPREntry(pr, inputs) {
    try {
        if (!pr) {
            core.setFailed("No pull request found in the GitHub context.")
            return
        }
    
        const body = pr.body || ""
    
      // 3. Parse the code blocks with `lang: changes`
        const changeBlocks = parseChangesBlocks(body)
    
      // 4. Convert each block into ChangeEntry objects
        const changes = parseChangeEntries(pr, changeBlocks)
    
        const allowedSections = inputs.allowedSections
        .split(/[\n,\s]+/)
        .map((s) => s.trim())
        .filter((s) => s !== "")
    
        const validator = getValidator(allowedSections)
    
        const validatedChanges = changes.map((c) => validator.validate(c))
    
        const invalid = validatedChanges.filter((c) => !c.valid())
        if (invalid.length > 0) {
            const msgs = invalid.map((c) => {
                return `PR #${c.pull_request.split("/").pop()}: ${c.validate().join(", ")}`
            })
            core.setFailed("Invalid changes found:\n" + msgs.join("\n"))
            return
        }
    
        core.info("All changes are valid!")
    
    } catch (err) {
        if (err instanceof Error) {
            core.setFailed(err.message)
        } else {
            core.setFailed(String(err))
        }
    }
}