import config from "./config.js";
import minimist from 'minimist';
import { bbClientInit } from './bitbucketClient.js';
import { writeCSVResults } from "./unapprovedPRCsvLogger.js"

const bitbucketClient = bbClientInit();

const REPOSITORIES = config.BITBUCKET_REPOSITORIES;
const args = minimist(process.argv.slice(2));

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
    for (const repo of REPOSITORIES) {
        console.log(`Processing repository: ${repo}`);
        console.log(`------------------------------`);

        const pullRequests = await bitbucketClient.getMergedPullRequests(repo, FROM_DATE);

        for (const pr of pullRequests) {
            pr.approvalStatus = getApprovalStatus(pr);
        }

        const notCompliantPRs = pullRequests.filter(pr => pr.approvalStatus.startsWith("NOT_COMPLIANT"));
        const semiCompliantPRs = pullRequests.filter(pr => pr.approvalStatus.startsWith("SEMI_COMPLIANT"));
        const compliant = pullRequests.filter(pr => pr.approvalStatus.startsWith("COMPLIANT"));
        console.log(`Not Compliant: ${notCompliantPRs.length}/${pullRequests.length}`);
        for (let pr of notCompliantPRs) {
            console.log(pr.links.html.href);
        }
        console.log(`Semi Compliant: ${semiCompliantPRs.length}/${pullRequests.length}`);
        for (let pr of semiCompliantPRs) {
            console.log(pr.links.html.href);
        }
        console.log(`Compliant: ${compliant.length}/${pullRequests.length}`);
        for (let pr of compliant) {
            console.log(pr.links.html.href);
        }
        console.log(`------------------------------\n\n`);

        writeCSVResults(repo, pullRequests);
    }

}
