import { assertEquals } from "https://deno.land/std@0.153.0/testing/asserts.ts";
import { parseJiraIdsFromSlackTextBody } from "./jira_helpers.ts";

Deno.test("Single jira ticket in simple string", async () => {
    const jiras = parseJiraIdsFromSlackTextBody("Verification thread for FOO-1234");
    assertEquals(jiras.length, 1);
    assertEquals(jiras[0], "FOO-1234");
});

Deno.test("Multiple jira ticket in simple string", async () => {
    const jiras = parseJiraIdsFromSlackTextBody("Verification thread for FOO-1234 and LOL-909");
    assertEquals(jiras.length, 2);
    assertEquals(jiras[0], "FOO-1234");
    assertEquals(jiras[1], "LOL-909");
});

Deno.test("Duplicate jira ticket in simple string", async () => {
    const jiras = parseJiraIdsFromSlackTextBody("Verification thread for FOO-1234 and LOL-909, FOO-1234 and LOL-909");
    assertEquals(jiras.length, 2);
    assertEquals(jiras[0], "FOO-1234");
    assertEquals(jiras[1], "LOL-909");
});

Deno.test("Duplicate jira ticket cause by hyperlinking", async () => {
    const jiras = parseJiraIdsFromSlackTextBody("Verification thread for *<https://boop.atlassian.net/browse/DOO-5634?atlOrigin=eyJpIjoiMDg5Yzc5Nzc2M2VhNGYzNzkzYTViMGZmOTcxNjE3NmEiLCJwIjoiamlyYS1zbGFjay1pbnQifQ&amp;focusedCommentId=462911&amp;page=com.atlassian.jira.plugin.system.issuetabpanels%3Acomment-tabpanel#comment-462911|DOO-5634 kira testing 2>* and DOO-5633 kjskdjasd");
    assertEquals(jiras.length, 2);
    assertEquals(jiras[0], "DOO-5634");
    assertEquals(jiras[1], "DOO-5633");
});

Deno.test("Multiple jira ticket in multiline string", async () => {
    const jiras = parseJiraIdsFromSlackTextBody(`Verification thread for FOO-1234 and LOL-909
        
        oh and maybe this ticket too:
        HIP-8908`);
    assertEquals(jiras.length, 3);
    assertEquals(jiras[0], "FOO-1234");
    assertEquals(jiras[1], "LOL-909");
    assertEquals(jiras[2], "HIP-8908");
});