import axios from 'axios';
import path from 'path';
import FileCache from 'node-file-cache';
import { jiraDomain, jiraUsername, jiraApiToken, jqlQuery, closedStatusName } from './config.js';
import { writeToCSV } from '../common/csvLogger.js';

const cache = FileCache.create();

const allPossibleStatuses = new Set();

const resultsDir = path.join(process.cwd(), 'results');
if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
}

async function fetchIssues() {
    let allIssues = [];
    let startAt = 0;
    const maxResults = 100;

    try {
        while (true) {
            const response = await axios.get(`https://${jiraDomain}/rest/api/3/search`, {
                auth: { username: jiraUsername, password: jiraApiToken },
                params: { jql: jqlQuery, startAt, maxResults, expand: 'changelog' }
            });

            console.log(`${startAt + 1} of ${response.data.total} processed`);
            allIssues = allIssues.concat(response.data.issues);
            startAt += maxResults;

            if (startAt >= response.data.total) {
                break;
            }
        }
    } catch (error) {
        console.error('Error fetching issues:', error);
        throw error;
    }

    return allIssues;
}

function calculateTimeInStatus(issue) {
    const changelog = issue.changelog;
    const issueCreatedAt = new Date(issue.fields.created);
    const timeSpent = {};
    const startTimeOfStatus = {}

    if (changelog.maxResults > changelog.total) {
        console.log(`${issueKey}: Did not fetch full changelog history`);
    }

    changelog.histories.toReversed().forEach(history => {
        history.items.forEach(item => {
            if (item.field === 'status') {
                const toStatus = item.toString;
                const fromStatus = item.fromString;

                // console.log("fromStatus:", fromStatus);
                // console.log("toStatus:", toStatus);

                const isFirstTicketTransition = Object.keys(startTimeOfStatus).length === 0;
                if (isFirstTicketTransition) {
                    startTimeOfStatus[fromStatus] = issueCreatedAt;
                }
                startTimeOfStatus[toStatus] = new Date(history.created);

                // console.log("startTimeOfFromStatus:", startTimeOfStatus[fromStatus]);
                // console.log("startTimeOfToStatus:", startTimeOfStatus[toStatus]);
                const timeInStatus = startTimeOfStatus[toStatus] - startTimeOfStatus[fromStatus];
                // console.log(`Time in ${fromStatus} was ${Math.round(timeInStatus / (1000 * 60))} minutes\n`);
                if (!timeSpent[fromStatus]) {
                    timeSpent[fromStatus] = 0;
                }
                timeSpent[fromStatus] += timeInStatus;
                allPossibleStatuses.add(fromStatus);
            }
        });
    });

    const currentStatus = issue.fields.status.name;
    if (currentStatus != closedStatusName) {
        const hasHadNoTicketTransitions = Object.keys(timeSpent).length === 0;
        const now = new Date();
        if (!timeSpent[currentStatus]) {
            timeSpent[currentStatus] = 0;
        }
        if (hasHadNoTicketTransitions) {
            timeSpent[currentStatus] = now - issueCreatedAt;
        } else {
            const timeInStatus = now - startTimeOfStatus[currentStatus];
            timeSpent[currentStatus] += timeInStatus;
        }
    } else {
        const resolutionDate = new Date(issue.fields.resolutiondate);
        timeSpent.cycleTime = resolutionDate - issueCreatedAt;
    }

    // console.log("timeSpent", timeSpent);
    return timeSpent;
}

// Function to process issues and write to CSV
async function processIssues() {
    try {
        const issues = await fetchIssues();
        const results = [];

        for (const issue of issues) {
            const issueKey = issue.key;
            const issueStatus = issue.fields.status.name;

            if (issueStatus === closedStatusName) {
                const cachedIssue = cache.get(issueKey);
                if (cachedIssue) {
                    console.log(`Cache hit: ${issueKey}`);
                    results.push(cachedIssue);
                    continue; // Skip recalculation if cached
                }
            }

            console.log(`Calculating: ${issueKey}`);
            const timeInStatus = calculateTimeInStatus(issue);

            const issueRow = {
                project: issue.fields.project.key,
                key: issueKey,
                ...timeInStatus
            };

            // Cache the resolved issue
            if (issueStatus === closedStatusName) {
                cache.set(issueKey, issueRow);
            }

            results.push(issueRow);
        }

        // Convert results to CSV and write to file
        const csvFilePath = path.join(resultsDir, 'jira_issues_time_in_status.csv');
        writeToCSV(csvFilePath, ['project', 'key', 'cycleTime', ...allPossibleStatuses], results, { defaultValue: 0})
    } catch (error) {
        console.error('Error processing issues:', error);
    }
}

processIssues();
