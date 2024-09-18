import fs from 'fs';

export function initializeCsvWriter() {
    const resultsFilePath = "results/prApprovalStatuses.csv";
    try {
        fs.accessSync(resultsFilePath, fs.constants.R_OK);
        fs.unlinkSync(resultsFilePath)
    } catch (err) {
        // Do nothing - there's no file yet.
    }

    const stream = fs.createWriteStream(resultsFilePath, { flags: 'a' });
    const header = "Repo, PR number, PR Url, Created at, Approval Status\n";
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
        `${pr.links.html.href}`,
        `${new Date(pr.created_on).toISOString()}`,
        pr.approvalStatus
    ].join(',');
}
