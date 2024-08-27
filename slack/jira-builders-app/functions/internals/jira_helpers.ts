export function CallJiraAutomationWebhookFromString(str: string): string[] {
    const jiraTicketIDRegex = /\b[A-Za-z]+-\d+\b/g;
    return [...str.matchAll(jiraTicketIDRegex)].map(matchGroups => matchGroups[0]);
}