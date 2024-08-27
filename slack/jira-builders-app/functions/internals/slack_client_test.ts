import { assertEquals } from "https://deno.land/std@0.153.0/testing/asserts.ts";
import { getSlackMessageFromPermalink, SLACK_NO_MESSAGE_FOUND } from "./slack_client.ts";


Deno.test("Retrieve top level message from 200 response with one message", async () => {
    const messageText =  "message-text";
    const client = {
        conversations: {
            join: async () => { },
            history: async () => {
                return new Promise((resolve, reject) => {
                    return resolve({
                        "ok": true,
                        "oldest": "1670566778.964519",
                        "messages": [
                            {
                                "type": "message",
                                "text": messageText,
                                "user": "U03E94MK0",
                                "ts": "1670566778.964519",
                                "team": "T03E94MJU",
                                "thread_ts": "1670566778.964519",
                                "reply_count": 3,
                                "reply_users_count": 1,
                                "latest_reply": "1670570301.090889",
                                "reply_users": ["U04EJMQQEFN"],
                                "is_locked": false,
                                "subscribed": false,
                                "reactions": [{ "name": "jp", "users": ["U03E94MK0"], "count": 1 }],
                            },
                        ],
                        "has_more": false,
                        "pin_count": 0,
                        "channel_actions_ts": null,
                        "channel_actions_count": 0,
                    }
                    );
                })
            },
        }
    }

    const message = await getSlackMessageFromPermalink(client, new URL("https://ghostbusters.slack.com/archives/C1H9RESGA/p670566778964519"));
    assertEquals(message, messageText);
});

Deno.test("Retrieve top level message with error response", async () => {
    const errorMsg =  "no-bot-access";
    const client = {
        conversations: {
            join: async () => { },
            history: async () => {
                return new Promise((resolve, reject) => {
                    return resolve({
                        "ok": true,
                        "oldest": "1670566778.964519",
                        "error": errorMsg,
                        "has_more": false,
                        "pin_count": 0,
                        "channel_actions_ts": null,
                        "channel_actions_count": 0,
                    }
                    );
                })
            },
        }
    }

    const message = await getSlackMessageFromPermalink(client, new URL("https://ghostbusters.slack.com/archives/C1H9RESGL/p135854651700023"));
    assertEquals(message.error, errorMsg);
});

Deno.test("Retrieve top level message with no messages", async () => {
    const errorMsg =  "no-bot-access";
    const client = {
        conversations: {
            join: async () => { },
            history: async () => {
                return new Promise((resolve, reject) => {
                    return resolve({
                        "ok": true,
                        "oldest": "1670566778.964519",
                        "messages": [],
                        "has_more": false,
                        "pin_count": 0,
                        "channel_actions_ts": null,
                        "channel_actions_count": 0,
                    }
                    );
                })
            },
        }
    }

    const message = await getSlackMessageFromPermalink(client, new URL("https://ghostbusters.slack.com/archives/C1H9RESGL/p135854651700023"));
    assertEquals(message.error, SLACK_NO_MESSAGE_FOUND);
});

Deno.test("Retrieve thread level message with one message", async () => {
    const messageText =  "message-text";
    const client = {
        conversations: {
            join: async () => { },
            replies: async () => {
                return new Promise((resolve, reject) => {
                    return resolve({
                        "ok": true,
                        "oldest": "1670566778.964519",
                        "messages": [
                            {
                                "type": "message",
                                "text": messageText,
                                "user": "U03E94MK0",
                                "ts": "1670566778.964519",
                                "team": "T03E94MJU",
                                "thread_ts": "1670566778.964519",
                                "reply_count": 3,
                                "reply_users_count": 1,
                                "latest_reply": "1670570301.090889",
                                "reply_users": ["U04EJMQQEFN"],
                                "is_locked": false,
                                "subscribed": false,
                                "reactions": [{ "name": "jp", "users": ["U03E94MK0"], "count": 1 }],
                            },
                        ],
                        "has_more": false,
                        "pin_count": 0,
                        "channel_actions_ts": null,
                        "channel_actions_count": 0,
                    }
                    );
                })
            },
        }
    }

    const message = await getSlackMessageFromPermalink(client, new URL("https://ghostbusters.slack.com/archives/C1H9RESGL/p135854651700023?thread_ts=1358546515.000008&cid=C1H9RESGL"));
    assertEquals(message, messageText);
});

Deno.test("Retrieve thread level message with error response", async () => {
    const errorMsg =  "no-bot-access";
    const client = {
        conversations: {
            join: async () => { },
            replies: async () => {
                return new Promise((resolve, reject) => {
                    return resolve({
                        "ok": true,
                        "oldest": "1670566778.964519",
                        "error": errorMsg,
                        "has_more": false,
                        "pin_count": 0,
                        "channel_actions_ts": null,
                        "channel_actions_count": 0,
                    }
                    );
                })
            },
        }
    }

    const message = await getSlackMessageFromPermalink(client, new URL("https://ghostbusters.slack.com/archives/C1H9RESGL/p135854651700023?thread_ts=1358546515.000008&cid=C1H9RESGL"));
    assertEquals(message.error, errorMsg);
});

Deno.test("Retrieve thread level message with no messages", async () => {
    const errorMsg =  "no-bot-access";
    const client = {
        conversations: {
            join: async () => { },
            replies: async () => {
                return new Promise((resolve, reject) => {
                    return resolve({
                        "ok": true,
                        "oldest": "1670566778.964519",
                        "messages": [],
                        "has_more": false,
                        "pin_count": 0,
                        "channel_actions_ts": null,
                        "channel_actions_count": 0,
                    }
                    );
                })
            },
        }
    }

    const message = await getSlackMessageFromPermalink(client, new URL("https://ghostbusters.slack.com/archives/C1H9RESGL/p135854651700023?thread_ts=1358546515.000008&cid=C1H9RESGL"));
    assertEquals(message.error, SLACK_NO_MESSAGE_FOUND);
});