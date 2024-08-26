import { assertEquals } from "https://deno.land/std@0.153.0/testing/asserts.ts";
import { parseSlackPermalink } from "./slack_helpers.ts";

Deno.test("Parse top level message permalink", async () => {
    const {channelId, messageTS, threadTS} = parseSlackPermalink(new URL("https://ghostbusters.slack.com/archives/C1H9RESGA/p1358546515000008"));
    assertEquals(channelId, "C1H9RESGA");
    assertEquals(messageTS, "1358546515.000008");
    assertEquals(threadTS, undefined);
});

Deno.test("Parse threaded message permalink", async () => {
    const {channelId, messageTS, threadTS} = parseSlackPermalink(new URL("https://ghostbusters.slack.com/archives/C1H9RESGL/p135854651700023?thread_ts=1358546515.000008&cid=C1H9RESGL"));
    assertEquals(channelId, "C1H9RESGL");
    assertEquals(messageTS, "1358546515.000008");
    assertEquals(threadTS, "135854651.700023");
});