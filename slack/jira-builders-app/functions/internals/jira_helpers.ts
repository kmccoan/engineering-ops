export function parseJiraIdsFromSlackTextBody(slackTextBody: string): string[] {
    const jiraTicketIDRegex = /\b[A-Za-z]+-\d+\b/g;
    const hyperLinkMatcher = /<([^|]+)\|([^>]+)>/g;
    const slackTextBodyWithNoLinks = slackTextBody.replaceAll(hyperLinkMatcher, '$2');

    console.log('slackTextBody', slackTextBody);
    console.log('slackTextBodyWithNoLinks', slackTextBodyWithNoLinks);
    return [...new Set([...slackTextBodyWithNoLinks.matchAll(jiraTicketIDRegex)].map(matchGroups => matchGroups[0]))];
}