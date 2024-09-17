import fs from 'fs';

export function writeCSVResults(repo, pullRequests) {
    const rows = getPullRequestRows(repo, pullRequests);
    try {
        fs.writeFileSync(
            `results/${repo}-results.csv`,
            rows
        )
    } catch (err) {
        console.error(err)
    }
}

function getPullRequestRows(repo, pullRequests) {
    const header = "Repo, PR number, Created at, Approval Status";
    pullRequests.sort((a, b) => { return parseInt(b.id) - parseInt(a.id)});
    const rows = pullRequests
        .map(pr => [
            repo,
            `${pr.id}`,
            `${new Date(pr.created_on)}`,
            pr.approvalStatus
        ].join(','));

    return [header].concat(rows).join(`\n`);
}