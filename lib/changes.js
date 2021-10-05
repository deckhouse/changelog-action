System.register([], function (exports_1, context_1) {
    "use strict";
    var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    var Change, PullRequestChange, CHANGE_TYPE_UNKNOWN;
    var __moduleName = context_1 && context_1.id;
    // This function expects an array of pull requests belonging to single milestone
    function collectChanges(inputs) {
        return __awaiter(this, void 0, void 0, function* () {
            const { pulls } = inputs;
            if (pulls.length === 0) {
                return "";
            }
            const milestone = pulls[0].milestone.title;
            //   console.log("passed pull requests", JSON.stringify(pulls, null, 2))
            const changesByModule = collectChangelog(pulls);
            //   console.log({ chlog: changesByModule, milestone })
            const body = formatBody(milestone, changesByModule);
            return body;
        });
    }
    exports_1("collectChanges", collectChanges);
    function formatBody(milestone, changesByModule) {
        const header = `## Changelog ${milestone}`;
        const chlog = JSON.stringify(changesByModule, null, 2);
        const body = [header, chlog].join("\r\n\r\n");
        return body;
    }
    // pull requests object => changes by modules
    function collectChangelog(pulls) {
        return pulls
            .filter((pr) => pr.state == "MERGED")
            .map((pr) => parseChanges(pr, parseChange, fallbackChange))
            .reduce(groupModules, {});
    }
    // TODO tests on various malformed changelogs
    function parseChanges(pr, parseOne, fallback) {
        let rawChanges = "";
        try {
            rawChanges = pr.body.split("```changelog")[1].split("```")[0];
        }
        catch (e) {
            return [fallback(pr)];
        }
        const changes = rawChanges
            .split("---")
            .filter((x) => !!x.trim()) // exclude empty strings
            .map((raw) => parseOne(pr, raw));
        if (changes.length == 0 || changes.some((c) => !c.valid())) {
            return [fallback(pr)];
        }
        return changes;
    }
    /**
     * @function parseSingleChange parses raw text entry to change object. Multi-line values are not supported.
     * @param {{ url: string; }} pr
     * @param {string} raw
     *
     * Input:
     *
     * `pr`:
     *
     * ```json
     * pr = {
     *   "url": "https://github.com/owner/repo/pulls/151"
     * }
     * ```
     *
     * `raw`:
     *
     * ```change
     * module: module3
     * type: fix
     * description: what was fixed in 151
     * resolves: #16, #32
     * note: Network flap is expected, but no longer than 10 seconds
     * ```
     *
     * Output:
     * ```json
     * {
     *   "module": "module3",
     *   "type": "fix",
     *   "description": "what was fixed in 151",
     *   "note": "Network flap is expected, but no longer than 10 seconds",
     *   "resolves": [
     *     "https://github.com/deckhouse/dekchouse/issues/16",
     *     "https://github.com/deckhouse/dekchouse/issues/32"
     *   ],
     *   "pull_request": "https://github.com/deckhouse/dekchouse/pulls/151"
     * }
     * ```
     *
     */
    function parseChange(pr, raw) {
        const opts = {
            module: "",
            type: "",
            description: "",
            pull_request: pr.url,
        };
        const lines = raw.split("\n");
        for (const line of lines) {
            if (!line.trim()) {
                continue;
            }
            const [k, ...vs] = line.split(":");
            const v = vs.join(":").trim();
            if (!(k in opts)) {
                continue; // set only known keys
            }
            opts[k] = v;
        }
        return new PullRequestChange(opts);
    }
    function fallbackChange(pr) {
        return new PullRequestChange({
            module: "UNKNOWN",
            type: CHANGE_TYPE_UNKNOWN,
            description: `${pr.title} (#${pr.number})`,
            pull_request: pr.url,
        });
    }
    function groupModules(acc, changes) {
        for (const c of changes) {
            try {
                addChange(acc, c);
            }
            catch (e) {
                console.log(`by module = ${JSON.stringify(acc, null, 2)}`);
                console.error(`cannot add change ${JSON.stringify(c, null, 2)}`);
                throw e;
            }
        }
        return acc;
    }
    function addChange(acc, change) {
        // ensure module key:   { "module": {} }
        acc[change.module] = acc[change.module] || {};
        const mc = acc[change.module];
        const ensure = (k) => {
            mc[k] = mc[k] || [];
            return mc[k];
        };
        // ensure module change list
        // e.g. for fixes: { "module": { "fixes": [] } }
        let list;
        switch (change.type) {
            case "fix":
                list = ensure("fixes");
                break;
            case "feature":
                list = ensure("features");
                break;
            case CHANGE_TYPE_UNKNOWN:
                list = ensure("UNKNOWN");
                break;
            default:
                throw new Error(`unknown change type "${change.type}"`);
        }
        // add the change
        list.push(new Change({
            description: change.description,
            pull_request: change.pull_request,
            note: change.note,
        }));
    }
    return {
        setters: [],
        execute: function () {
            /**
             *  Change is the change entry to be included in changelog
             */
            Change = class Change {
                constructor(o) {
                    this.description = "";
                    this.pull_request = "";
                    this.note = undefined;
                    this.description = o.description;
                    this.pull_request = o.pull_request;
                    if (o.note) {
                        this.note = o.note;
                    }
                }
                // All required fields should be filled
                valid() {
                    return this.description && this.pull_request;
                }
            };
            /**
             *  PullRequestChange is the change we expect to find in pull request
             */
            PullRequestChange = class PullRequestChange extends Change {
                constructor(o) {
                    super(o);
                    this.module = "";
                    this.type = "";
                    this.module = o.module;
                    this.type = o.type;
                }
                // All required fields should be filled
                valid() {
                    return this.module && this.type && super.valid();
                }
            };
            CHANGE_TYPE_UNKNOWN = "unknown";
        }
    };
});
