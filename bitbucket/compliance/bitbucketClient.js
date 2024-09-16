const axios = require('axios');
const PromiseThrottle = require('promise-throttle');
const cache = require('node-file-cache').create({
    file: "./bitbucketCache.json",
    life: 1728000 //Cache for 20 days.
});
const config = require("./config");

module.exports = function () {
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

    const promiseThrottle = new PromiseThrottle({
        requestsPerSecond: REQUESTS_PER_SECOND_THROTTLE,
        promiseImplementation: Promise,
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
        const allMergedPRs = [];
        let next = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests`;
        // while (next) {
            const response = await (throttledRequest(() => axiosInstance.get(next, {
                params: {
                    state: 'MERGED',
                    sort: '-created_on'
                },
            })));

            const mergedPRs = response.data.values;
            const mergedPRsWithinTimeframe = mergedPRs.filter(pull => new Date(pull.created_on) - from >= 0);
            allMergedPRs.push(mergedPRsWithinTimeframe);

            if (mergedPRs.length !== mergedPRsWithinTimeframe.length) {
                // break;
            }
            next = response.data.next;
        // }

        return allMergedPRs.flat();
    }

    async function enrichMergedPRs(repo, prs) {
        const enrichedPRs = [];

        for (let pr of prs) {
            if (cache.get(prCacheKey(pr))) {
                enrichedPRs.push(cache.get(prCacheKey(pr)));
                console.log(`Using cached version for ${pr.id}`);
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
        return enrichedPRs;
    }

    async function getPullRequestActivity(repo, pullRequestId) {
        let next = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${pullRequestId}/activity`;

        const activity = [];
        while (next) {
            try {
                console.log(`Fetching activity for ${pullRequestId}`);
                const response = await (throttledRequest(() => axiosInstance.get(next)));
                activity.push(...response.data.values);
                next = response.data.next;
            } catch (error) {
                console.error(`Error fetching pull request activity for PR ${pullRequestId}:`, error.message);
                return [];
            }
        }
        console.log(`Fetched activity for ${pullRequestId}`);
        return activity;
    }

    async function throttledRequest(requestFunction) {
        return promiseThrottle.add(requestFunction)
    }

    return {
        getMergedPullRequests: getMergedPullRequests
    }
}

function prCacheKey(pr) {
    return `${pr.source.repository.name}-${pr.id}`;
}
