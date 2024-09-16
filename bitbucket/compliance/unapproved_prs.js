import config from "./config.js";
import minimist from 'minimist';
import {bbClientInit} from './bitbucketClient.js';
const bitbucketClient = bbClientInit();

const REPOSITORIES = config.BITBUCKET_REPOSITORIES;
const args = minimist(process.argv.slice(2));

const FROM_DATE = config.FROM_DATE;

processRepositories();

function wasMergedBeforeApproval(activity) {
    let mergeDate = null;
    let approvalDate = null;

    activity.forEach(event => {
        if (event.update && event.update.state === 'MERGED') {
            mergeDate = new Date(event.update.date);
        }

        if (event.approval) {
            const approvalEventDate = new Date(event.approval.date);
            if (!approvalDate || approvalEventDate < approvalDate) {
                approvalDate = approvalEventDate;
            }
        }
    });

    return mergeDate && (!approvalDate || mergeDate < approvalDate);
}

async function processRepositories() {
    for (const repo of REPOSITORIES) {
        console.log(`Processing repository: ${repo}`);
        console.log(`------------------------------`);

        const pullRequests = await bitbucketClient.getMergedPullRequests(repo, FROM_DATE);

        const mergedWithoutApproval = [];
        for (const pr of pullRequests) {
            if (wasMergedBeforeApproval(pr.prActivity)) {
                mergedWithoutApproval.push(pr);
            }
        }

        console.log(`PRs merged before approval: ${mergedWithoutApproval.length}/${pullRequests.length}`);
        for (let unApprovedPR of mergedWithoutApproval) {
            console.log(unApprovedPR.links.html.href);
        }
        console.log(`------------------------------\n\n`);
    }

}
