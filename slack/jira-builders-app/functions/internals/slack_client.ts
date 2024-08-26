import { parseSlackPermalink } from "./slack_helpers.ts";

export async function getSlackMessageFromPermalink(client, permalink: URL) {
    const { channelId, messageTS, threadTS } = parseSlackPermalink(permalink);

    // Bot must be in public channel to access messages.
    await client.conversations.join({
        channel: channelId
    });

    if (threadTS) {
        const messagesResponse = await client.conversations.replies({
            channel: channelId,
            ts: threadTS,
            latest: messageTS,
            limit: 1,
            inclusive: true,
        });
        console.log("client.conversations.replies response:", messagesResponse);
        return messagesResponse.messages[0].text;
    } else {
        const messagesResponse = await client.conversations.history({
            channel: channelId,
            latest: messageTS,
            limit: 1,
            inclusive: true,
        });
        console.log("client.conversations.history response:", messagesResponse);
        return messagesResponse.messages[0].text;
    }
}