import { parseChangeEntries, parseChangesBlocks } from "./parse";
import { getValidator } from "./validator";
import * as core from "@actions/core"

export async function checkPREntry(pr, inputs) {
    try {
        const body = pr.body || ""
        core.info(`PR #${pr.number}: ${body}`)
    
      // 3. Parse the code blocks with `lang: changes`
        const changeBlocks = parseChangesBlocks(body)
        core.info(`Changeblocks: ${changeBlocks.join("\n")}`)
    
      // 4. Convert each block into ChangeEntry objects
        const changes = parseChangeEntries(pr, changeBlocks)
        core.info(`Changes: ${JSON.stringify(changes)}`)
    
        const allowedSections = inputs.allowedSections
        .split(/[\n,\s]+/)
        .map((s) => s.trim())
        .filter((s) => s !== "")
        core.info(`Allowed sections: ${JSON.stringify(allowedSections)}`)
    
        const validator = getValidator(allowedSections)
    
        const validatedChanges = changes.map((c) => validator.validate(c))
        core.info(`Validated changes: ${JSON.stringify(validatedChanges)}`)
    
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