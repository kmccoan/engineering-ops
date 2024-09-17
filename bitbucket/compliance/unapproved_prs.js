import config from "./config.js";
import { bbClientInit } from './bitbucketClient.js';
import { initializeCsvWriter } from "./unapprovedPRCsvLogger.js"

const bitbucketClient = bbClientInit();

const WORKSPACE_REPOSITORIES = config.BITBUCKET_WORKSPACE_REPOSITORIES;

const FROM_DATE = config.FROM_DATE;

processRepositories();

function getApprovalStatus(pr) {
    const activity = pr.prActivity;
    let mergeDate = null;
    const approvalDates = [];

    activity.forEach(event => {
        if (event.update && event.update.state === 'MERGED') {
            mergeDate = new Date(event.update.date);
        }

        if (event.approval) {
            const approvalEventDate = new Date(event.approval.date);
            approvalDates.push(approvalEventDate);
        }
    });

    if (!mergeDate) {
        throw new Error(`No merge date - wut? ${pr.links.html.href}`)
    }

    if (approvalDates.length === 0) {
        return 'NOT_COMPLIANT-MERGED_NO_APPROVAL';
    }

    const approvedBeforeMerge = approvalDates.some(approvalDate => mergeDate > approvalDate);
    const approvedAfterMerge = approvalDates.some(approvalDate => mergeDate < approvalDate);

    // These likely indicate that the author made a change after the first approval and then later got a second approval after merge?
    if (approvedBeforeMerge && approvedAfterMerge) {
        return 'SEMI_COMPLIANT-MERGED_WITH_ADDITIONAL_POST_APPROVAL';
    }

    //TODO: this doesn't guarantee no changes between approval & merge tho - need to flag those somehow?
    if (approvedBeforeMerge) {
        return 'COMPLIANT-MERGED_AFTER_APPROVAL';
    }

    if (approvedAfterMerge) {
        return 'NOT_COMPLIANT-MERGED_WITH_ONLY_POST_APPROVAL';
    }

    console.log(approvalDates);
    throw new Error(`What is this state? ${pr.links.html.href}. Merge date ${mergeDate}, approvedBeforeMerge: ${approvedBeforeMerge}, approvedAfterMerge: ${approvedAfterMerge}`)
}

async function processRepositories() {
    const csvResultWriter = initializeCsvWriter();
    for (const workspaceRepo of WORKSPACE_REPOSITORIES) {
        console.log(`Processing repository: ${workspaceRepo}`);
        console.log(`------------------------------`);

        const pullRequests = await bitbucketClient.getMergedPullRequests(workspaceRepo, FROM_DATE);

        for (const pr of pullRequests) {
            pr.approvalStatus = getApprovalStatus(pr);
            csvResultWriter.appendResult(workspaceRepo, pr);
        }

        const notCompliantPRs = pullRequests.filter(pr => pr.approvalStatus.startsWith("NOT_COMPLIANT"));
        const semiCompliantPRs = pullRequests.filter(pr => pr.approvalStatus.startsWith("SEMI_COMPLIANT"));
        const compliant = pullRequests.filter(pr => pr.approvalStatus.startsWith("COMPLIANT"));
        const totalPRCount = pullRequests.length;
        logSummary("Not Compliant", notCompliantPRs.length, totalPRCount);
        for (let pr of notCompliantPRs) {
            console.log(pr.links.html.href);
        }
        logSummary("Semi Compliant", semiCompliantPRs.length, totalPRCount);
        for (let pr of semiCompliantPRs) {
            console.log(pr.links.html.href);
        }
        logSummary("Compliant", semiCompliantPRs.length, totalPRCount);
        for (let pr of compliant) {
            console.log(pr.links.html.href);
        }
        console.log(`------------------------------\n\n`);
    }
    csvResultWriter.end();
}

function logSummary(title, partial, total) {
    console.log(`${title}: ${percentage(partial, total)}% (${partial}/${total})`);
}

function percentage(partialValue, totalValue) {
    const percentageDecimal =  (100 * partialValue) / totalValue;
    return Math.round((percentageDecimal + Number.EPSILON) * 100) / 100;
 }
