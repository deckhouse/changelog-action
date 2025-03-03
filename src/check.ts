import { parseChangeEntries, parseChangesBlocks } from "./parse";
import { getValidator } from "./validator";
import * as core from "@actions/core"

export interface ValidateInput {
    pr: any
    allowedSections: string[]
}

export async function validatePREntry(validateInput: ValidateInput): Promise<boolean> {
    try {
        const body = validateInput.pr.body || ""
        core.debug(`PR #${validateInput.pr.number}: ${body}`)
    
      // 3. Parse the code blocks with `lang: changes`
        const changeBlocks = parseChangesBlocks(body)
        core.debug(`Changeblocks: ${changeBlocks.join("\n")}`)
    
      // 4. Convert each block into ChangeEntry objects
        const changes = parseChangeEntries(validateInput.pr, changeBlocks)
        core.debug(`Changes: ${JSON.stringify(changes)}`)
    
        const validator = getValidator(validateInput.allowedSections)
    
        const validatedChanges = changes.map((c) => validator.validate(c))
        core.debug(`Validated changes: ${JSON.stringify(validatedChanges)}`)
    
        const invalid = validatedChanges.filter((c) => !c.valid())
        if (invalid.length > 0) {
            const msgs = invalid.map((c) => {
                return `PR #${c.pull_request.split("/").pop()}: ${c.validate().join(", ")}`
            })
            core.setFailed("Fix issues in changes entry for valid changelog render:\n" + msgs.join("\n"))
            return false
        }
    
        core.debug("All changes are valid!")
        return true
    
    } catch (err) {
        if (err instanceof Error) {
            core.setFailed(err.message)
        } else {
            core.setFailed(String(err))
        }
        return false
    }
}