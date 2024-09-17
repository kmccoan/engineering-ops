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
    const codeUpdates = [];

    activity.forEach(event => {
        if (event.update && event.update.state === 'MERGED') {
            mergeDate = new Date(event.update.date);
        }

        if (event.approval) {
            const approvalEventDate = new Date(event.approval.date);
            approvalDates.push(approvalEventDate);
        }

        if (event.update && event.update.state === 'OPEN' && !Object.keys(event.update.changes).length) {
            const codeUpdate = new Date(event.update.date);
            codeUpdates.push(codeUpdate);
        }
    });

    if (!mergeDate) {
        throw new Error(`No merge date - wut? ${pr.links.html.href}`)
    }

    if (approvalDates.length === 0) {
        return 'NOT_COMPLIANT-MERGED_NO_APPROVAL';
    }
    const mostRecentApprovalBeforeMerge = findDateClosestBefore(approvalDates, mergeDate);
    const mostRecentApprovalAfterMerge = findDateClosestAfter(approvalDates, mergeDate);

    if (mostRecentApprovalBeforeMerge) {
        const codeUpdatesAfterApproval = codeUpdates.some(codeUpdateDate => {
            return mostRecentApprovalBeforeMerge < codeUpdateDate && codeUpdateDate < mergeDate;
        });
        if (codeUpdatesAfterApproval && mostRecentApprovalAfterMerge) {
            return 'SEMI_COMPLIANT-MERGED_WITH_ADDITIONAL_POST_APPROVAL';
        }
        if (codeUpdatesAfterApproval && !mostRecentApprovalAfterMerge) {
            return 'NOT_COMPLIANT-MERGED_WITH_CHANGES_NO_APPROVAL';
        }
        return 'COMPLIANT-MERGED_AFTER_APPROVAL';
    }

    if (mostRecentApprovalAfterMerge) {
        return 'NOT_COMPLIANT-MERGED_WITH_ONLY_POST_APPROVAL';
    }

    console.log(approvalDates);
    throw new Error(`What is this state? ${pr.links.html.href}. Merge date ${mergeDate}, mostRecentApprovalBeforeMerge: ${mostRecentApprovalBeforeMerge}, mostRecentApprovalAfterMerge: ${mostRecentApprovalAfterMerge}`)
}

async function processRepositories() {
    const csvResultWriter = initializeCsvWriter();
    for (const workspaceRepo of WORKSPACE_REPOSITORIES) {
        console.log(`Processing repository: ${workspaceRepo} from ${FROM_DATE.toISOString()}`);
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
        logSummary("Compliant", compliant.length, totalPRCount);
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
    const percentageDecimal = (100 * partialValue) / totalValue;
    return Math.round((percentageDecimal + Number.EPSILON) * 100) / 100;
}

function findDateClosestBefore(dates, date) {
    let closestBeforeDate = null;
    for (let d of dates) {
        if (d < date) {
            if (!closestBeforeDate) {
                closestBeforeDate = d;
            } else if (closestBeforeDate < d) {
                closestBeforeDate = d
            }
        }
    }
    return closestBeforeDate;
}


function findDateClosestAfter(dates, date) {
    let closestAfterDate = null;
    for (let d of dates) {
        if (d > date) {
            if (!closestAfterDate) {
                closestAfterDate = d;
            } else if (closestAfterDate > d) {
                closestAfterDate = d
            }
        }
    }
    return closestAfterDate;
}
