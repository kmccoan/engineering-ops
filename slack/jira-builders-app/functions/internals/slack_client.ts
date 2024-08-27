import { parseSlackPermalink } from "./slack_helpers.ts";

export const SLACK_NO_MESSAGE_FOUND = "no-message-found"
export interface SlackMessageResponse {
    error: string;
}

export async function getSlackMessageFromPermalink(client: any, permalink: URL) {
    const { channelId, messageTS, threadTS } = parseSlackPermalink(permalink);

    // Bot must be in public channel to access messages.
    await client.conversations.join({
        channel: channelId
    });

    const messagesResponse = await findMessage(client, channelId, messageTS, threadTS);

    if (messagesResponse.error) {
        return { error: messagesResponse.error }
    }

    if (messagesResponse.messages.length == 0) {
        return { error: SLACK_NO_MESSAGE_FOUND };
    }

    return messagesResponse.messages[0].text;
}

async function findMessage(client: any, channelId: string, messageTS: string, threadTS?: string) {
    if (threadTS) {
        const messagesResponse = await client.conversations.replies({
            channel: channelId,
            ts: threadTS,
            latest: messageTS,
            limit: 1,
            inclusive: true,
        });
        console.log("client.conversations.replies response:", messagesResponse);
        return messagesResponse;
    } else {
        const messagesResponse = await client.conversations.history({
            channel: channelId,
            latest: messageTS,
            limit: 1,
            inclusive: true,
        });
        console.log("client.conversations.history response:", messagesResponse);
        return messagesResponse;
    }
}