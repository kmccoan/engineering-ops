import fs from 'fs';

export function initializeCsvWriter() {
    const resultsFilePath = "results/prApprovalStatuses.csv";
    fs.unlinkSync( resultsFilePath )
    const stream = fs.createWriteStream(resultsFilePath, {flags:'a'});
    const header = "Repo, PR number, Created at, Approval Status\n";
    stream.write(header);

    return {
        appendResult: (workspaceRepo, pr) => {
            stream.write(prRow(workspaceRepo, pr) + "\n");
        },
        end: () => stream.end()
    }
}

function prRow(workspaceRepo, pr) {
    return [
        workspaceRepo,
        `${pr.id}`,
        `${new Date(pr.created_on).toISOString()}`,
        pr.approvalStatus
    ].join(',');
}
