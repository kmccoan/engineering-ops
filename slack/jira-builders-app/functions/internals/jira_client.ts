export async function callJiraWebhook(webhookUrl: URL, issueKeys: string[], slackPermalink: URL, slackMessage: string) {
    const jiraResponse = await fetch(webhookUrl.href, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            issues: issueKeys,
            slackPermalink: slackPermalink.href,
            slackMessage
        }),
    });
    return jiraResponse;
}