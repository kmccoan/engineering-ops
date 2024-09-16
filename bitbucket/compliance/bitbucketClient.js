import axios from 'axios';
import * as nfc from 'node-file-cache';
import pThrottle from 'p-throttle';
const cache = nfc.create({
    file: "./bitbucketCache.json",
    life: 1728000 //Cache for 20 days.
});
import config from "./config.js";

export function bbClientInit() {
    const workspace = config.BITBUCKET_WORKSPACE;
    const username = config.BITBUCKET_USERNAME;
    const password = config.BITBUCKET_PASSWORD;
    const REQUESTS_PER_SECOND_THROTTLE = 1;
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

    async function getMergedPullRequests(repo, fromDate) {
        try {
            const allMergedPRs = await getMergedPRs(repo, fromDate);
            const enrichedMergedPRs = await enrichMergedPRs(repo, allMergedPRs);
            return enrichedMergedPRs;
        } catch (error) {
            console.error(`Error fetching pull requests for ${repo}:`, error.message);
            return [];
        }
    }

    async function getMergedPRs(repo, from) {
        process.stdout.write(`Retrieving PRs for ${repo}`);
        const allMergedPRs = [];
        let next = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests`;
        while (next) {
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
            process.stdout.write(`.`);
            next = response.data.next;
        }

        process.stdout.write(`Done\n`);
        return allMergedPRs.flat();
    }

    async function enrichMergedPRs(repo, prs) {
        const enrichedPRs = [];
        process.stdout.write(`Enriching ${prs.length} PRs`);
        for (let pr of prs) {
            process.stdout.write(".");
            if (cache.get(prCacheKey(pr))) {
                enrichedPRs.push(cache.get(prCacheKey(pr)));
            } else {
                const prActivity = await getPullRequestActivity(repo, pr.id);
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

    async function getPullRequestActivity(repo, pullRequestId) {
        let next = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${pullRequestId}/activity`;

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
