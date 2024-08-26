// Slack permalinks are in this format https://ghostbusters.slack.com/archives/C1H9RESGA/p1358546515000008 (when top level message)
// or "https://ghostbusters.slack.com/archives/C1H9RESGL/p135854651700023?thread_ts=1358546515.000008&cid=C1H9RESGL" (when threaded msg.)
export function parseSlackPermalink(permalink: URL) {
    const path = permalink.pathname;
    const pathParts = path.split("/");
    const channelId = pathParts[2]; //C1H9RESGA
    const permalinkId = pathParts[3]; //p135854651500008
    let unformattedMessageTS = permalinkId.substring(1); //135854651500008
    console.log("channelId", channelId);
    console.log("permalinkId", permalinkId);
    console.log("unformattedMessageTS", unformattedMessageTS);
    if (unformattedMessageTS.indexOf('?') != -1) {
        unformattedMessageTS = unformattedMessageTS.substring(0, unformattedMessageTS.indexOf('?'));
    }
    const messageTS = unformattedMessageTS.substring(0, unformattedMessageTS.length - 6) + '.' + unformattedMessageTS.substring(unformattedMessageTS.length - 6); //1358546515.000008
    console.log("messageTS", messageTS);

    const topLevelMessageTS = permalink.searchParams.get("thread_ts");
    if (topLevelMessageTS) {
        console.log("threadTS", topLevelMessageTS);
        return {
            channelId,
            messageTS: topLevelMessageTS,
            threadTS: messageTS
        }
    }

    return {
        channelId,
        messageTS
    }
}