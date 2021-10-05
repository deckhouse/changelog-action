System.register(["@actions/core", "./changes"], function (exports_1, context_1) {
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
    var core, changes_1;
    var __moduleName = context_1 && context_1.id;
    function run() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const inputs = {
                    token: core.getInput("token"),
                    pulls: JSON.parse(core.getInput("pull_requests")),
                };
                // core.debug(`Inputs: ${inspect(inputs)}`)
                const body = yield changes_1.collectChanges(inputs);
                core.setOutput("body", body);
            }
            catch (error) {
                core.setFailed(error.message);
            }
        });
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
