const config = require("./config");
const minimist = require('minimist');
const bitbucketClient = require('./bitbucketClient')();

const REPOSITORIES = config.BITBUCKET_REPOSITORIES;
const args = minimist(process.argv.slice(2));

var defaultFromDate = new Date();
defaultFromDate.setDate(defaultFromDate.getDate() - 7);
const FROM_DATE = args.d || defaultFromDate;

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

        const pullRequests = await bitbucketClient.getMergedPullRequests(repo, FROM_DATE);

        const mergedWithoutApproval = [];
        for (const pr of pullRequests) {
            if (wasMergedBeforeApproval(pr.prActivity)) {
                mergedWithoutApproval.push(pr);
            }
        }

        console.log(`PRs merged before approval: ${mergedWithoutApproval.length}/${pullRequests.length}`);
        for (let unApprovedPR of mergedWithoutApproval) {
            console.log(unApprovedPR.links.self.href);
        }
    }

}
