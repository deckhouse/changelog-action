import { parseChangeEntries, parseChangesBlocks } from "./parse";
import { Pull } from "./client"
import { getValidator } from "./validator";
import * as core from "@actions/core"

export interface CheckInput {
	pr: any
    allowedSections: string[]
}

export async function checkPREntry(checkInput: CheckInput) {
    try {
        const body = checkInput.pr.body || ""
        core.debug(`PR #${checkInput.pr.number}: ${body}`)
    
      // 3. Parse the code blocks with `lang: changes`
        const changeBlocks = parseChangesBlocks(body)
        core.debug(`Changeblocks: ${changeBlocks.join("\n")}`)
    
      // 4. Convert each block into ChangeEntry objects
        const changes = parseChangeEntries(checkInput.pr, changeBlocks)
        core.debug(`Changes: ${JSON.stringify(changes)}`)
    
        const validator = getValidator(checkInput.allowedSections)
    
        const validatedChanges = changes.map((c) => validator.validate(c))
        core.debug(`Validated changes: ${JSON.stringify(validatedChanges)}`)
    
        const invalid = validatedChanges.filter((c) => !c.valid())
        if (invalid.length > 0) {
            const msgs = invalid.map((c) => {
                return `PR #${c.pull_request.split("/").pop()}: ${c.validate().join(", ")}`
            })
            core.setFailed("Invalid changes found:\n" + msgs.join("\n"))
            return
        }
    
        core.debug("All changes are valid!")
    
    } catch (err) {
        if (err instanceof Error) {
            core.setFailed(err.message)
        } else {
            core.setFailed(String(err))
        }
    }
}