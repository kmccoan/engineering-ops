import axios from 'axios';
import * as nfc from 'node-file-cache';
import pThrottle from 'p-throttle';
const cache = nfc.create({
    file: "./bitbucketCache.json",
    life: 1728000 //Cache for 20 days.
});
import config from "./config.js";

export function bbClientInit() {
    const username = config.BITBUCKET_USERNAME;
    const password = config.BITBUCKET_PASSWORD;
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const axiosInstance = axios.create({
        headers: {
            'Authorization': `Basic ${auth}`,
        }
    });

    const throttle = pThrottle({
        limit: 999,
        interval: 3600000
    });

    async function getMergedPullRequests(workspaceRepo, fromDate) {
        try {
            const allMergedPRs = await getMergedPRs(workspaceRepo, fromDate);
            const enrichedMergedPRs = await enrichMergedPRs(workspaceRepo, allMergedPRs);
            return enrichedMergedPRs;
        } catch (error) {
            console.error(`Error fetching pull requests for ${workspaceRepo}:`, error.message);
            return [];
        }
    }

    async function getMergedPRs(workspaceRepo, from) {
        process.stdout.write(`Retrieving PRs for ${workspaceRepo}`);
        const allMergedPRs = [];
        let next = `https://api.bitbucket.org/2.0/repositories/${workspaceRepo}/pullrequests`;
        while (next) {
            process.stdout.write(`.`);
            const throttledRequest = throttle(() => axiosInstance.get(next, {
                params: {
                    state: 'MERGED',
                    sort: '-created_on'
                },
            }));
            const response = await throttledRequest();

            const mergedPRs = response.data.values;
            const mergedPRsWithinTimeframe = mergedPRs.filter(pull => new Date(pull.created_on) - from >= 0);
            allMergedPRs.push(mergedPRsWithinTimeframe);

            if (mergedPRs.length !== mergedPRsWithinTimeframe.length) {
                break;
            }
            next = response.data.next;
        }

        process.stdout.write(`Done\n`);
        return allMergedPRs.flat();
    }

    async function enrichMergedPRs(workspaceRepo, prs) {
        const enrichedPRs = [];
        process.stdout.write(`Enriching ${prs.length} PRs`);
        for (let pr of prs) {
            process.stdout.write(".");
            if (cache.get(prCacheKey(pr))) {
                enrichedPRs.push(cache.get(prCacheKey(pr)));
            } else {
                const prActivity = await getPullRequestActivity(workspaceRepo, pr.id);
                const enrichedPR = {
                    ...pr,
                    prActivity
                };
                enrichedPRs.push(enrichedPR);
                cache.set(prCacheKey(pr), enrichedPR);
            }
        }
        process.stdout.write(`Done\n`);
        return enrichedPRs;
    }

    async function getPullRequestActivity(workspaceRepo, pullRequestId) {
        let next = `https://api.bitbucket.org/2.0/repositories/${workspaceRepo}/pullrequests/${pullRequestId}/activity`;

        const activity = [];
        while (next) {
            try {
                const throttledRequest = throttle(() => axiosInstance.get(next));
                const response = await throttledRequest();
                activity.push(...response.data.values);
                next = response.data.next;
            } catch (error) {
                console.error(`Error fetching pull request activity for PR ${pullRequestId}:`, error.message);
                return [];
            }
        }
        return activity;
    }

    return {
        getMergedPullRequests: getMergedPullRequests
    }
}

function prCacheKey(pr) {
    return `${pr.source.repository.name}-${pr.id}`;
}
