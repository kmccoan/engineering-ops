export async function callJiraWebhookWithSlackMessageInfo(webhookUrl: URL, issueKeys: string[], slackPermalink: URL, slackMessage: string) {
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

export async function callJiraWebhookWithUserInfo(webhookUrl: URL, slackUserId: string, slackUserEmail: string, slackUsername: string) {
    const jiraResponse = await fetch(webhookUrl.href, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            slackUserId,
            slackUserEmail,
            slackUsername
        }),
    });
    return jiraResponse;
}