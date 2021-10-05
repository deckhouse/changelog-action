export interface PullRequest {
    state: string;
    number: number;
    url: string;
    title: string;
    body: string;
    milestone: {
        title: string;
        number: number;
    };
}
export interface Inputs {
    token: string;
    pulls: PullRequest[];
}
export declare function collectChanges(inputs: Inputs): Promise<string>;
