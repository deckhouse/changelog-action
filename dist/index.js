System.register("changes", [], function (exports_1, context_1) {
    "use strict";
    var prChangeFields, Change, PullRequestChange, CHANGE_TYPE_UNKNOWN;
    var __moduleName = context_1 && context_1.id;
    async function collectChanges(inputs) {
        const { pulls } = inputs;
        if (pulls.length === 0) {
            return "";
        }
        const milestone = pulls[0].milestone.title;
        const changesByModule = collectChangelog(pulls);
        const body = formatBody(milestone, changesByModule);
        return body;
    }
    exports_1("collectChanges", collectChanges);
    function formatBody(milestone, changesByModule) {
        const header = `## Changelog ${milestone}`;
        const chlog = JSON.stringify(changesByModule, null, 2);
        const body = [header, chlog].join("\r\n\r\n");
        return body;
    }
    function collectChangelog(pulls) {
        return pulls
            .filter((pr) => pr.state == "MERGED")
            .map((pr) => parsePullRequestChanges(pr, parseSingleChange, fallbackChange))
            .reduce(groupByModule, {});
    }
    function parsePullRequestChanges(pr, parseOne, fallback) {
        let rawChanges = "";
        try {
            rawChanges = pr.body.split("```changes")[1].split("```")[0];
        }
        catch (e) {
            return [fallback(pr)];
        }
        const changes = rawChanges
            .split("---")
            .filter((x) => !!x.trim())
            .map((raw) => parseOne(pr, raw));
        if (changes.length == 0 || changes.some((c) => !c.valid())) {
            console.log("fallback under conditions");
            return [fallback(pr)];
        }
        return changes;
    }
    exports_1("parsePullRequestChanges", parsePullRequestChanges);
    function parseSingleChange(pr, raw) {
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
            if (!prChangeFields.has(k)) {
                continue;
            }
            opts[k] = v;
        }
        return new PullRequestChange(opts);
    }
    exports_1("parseSingleChange", parseSingleChange);
    function fallbackChange(pr) {
        return new PullRequestChange({
            module: "UNKNOWN",
            type: CHANGE_TYPE_UNKNOWN,
            description: `${pr.title} (#${pr.number})`,
            pull_request: pr.url,
        });
    }
    function groupByModule(acc, changes) {
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
        acc[change.module] = acc[change.module] || {};
        const mc = acc[change.module];
        const ensure = (k) => {
            mc[k] = mc[k] || [];
            return mc[k];
        };
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
        list.push(new Change({
            description: change.description,
            pull_request: change.pull_request,
            note: change.note,
        }));
    }
    return {
        setters: [],
        execute: function () {
            prChangeFields = new Set(["module", "type", "description", "note", "pull_request"]);
            Change = class Change {
                description = "";
                pull_request = "";
                note;
                constructor(o) {
                    this.description = o.description;
                    this.pull_request = o.pull_request;
                    if (o.note) {
                        this.note = o.note;
                    }
                }
                valid() {
                    return !!this.description && !!this.pull_request;
                }
            };
            exports_1("Change", Change);
            PullRequestChange = class PullRequestChange extends Change {
                module = "";
                type = "";
                constructor(o) {
                    super(o);
                    this.module = o.module;
                    this.type = o.type;
                }
                valid() {
                    return !!this.module && !!this.type && super.valid();
                }
            };
            exports_1("PullRequestChange", PullRequestChange);
            CHANGE_TYPE_UNKNOWN = "unknown";
        }
    };
});
System.register("index", ["@actions/core", "changes"], function (exports_2, context_2) {
    "use strict";
    var core, changes_1;
    var __moduleName = context_2 && context_2.id;
    async function run() {
        try {
            const inputs = {
                token: core.getInput("token"),
                pulls: JSON.parse(core.getInput("pull_requests")),
            };
            const body = await changes_1.collectChanges(inputs);
            core.setOutput("body", body);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    }
    return {
        setters: [
            function (core_1) {
                core = core_1;
            },
            function (changes_1_1) {
                changes_1 = changes_1_1;
            }
        ],
        execute: function () {
            run();
        }
    };
});
