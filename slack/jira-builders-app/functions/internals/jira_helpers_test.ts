import { assertEquals } from "https://deno.land/std@0.153.0/testing/asserts.ts";
import { CallJiraAutomationWebhookFromString } from "./jira_helpers.ts";

Deno.test("Single jira ticket in simple string", async () => {
    const jiras = CallJiraAutomationWebhookFromString("Verification thread for FOO-1234");
    assertEquals(jiras.length, 1);
    assertEquals(jiras[0], "FOO-1234");
});

Deno.test("Multiple jira ticket in simple string", async () => {
    const jiras = CallJiraAutomationWebhookFromString("Verification thread for FOO-1234 and LOL-909");
    assertEquals(jiras.length, 2);
    assertEquals(jiras[0], "FOO-1234");
    assertEquals(jiras[1], "LOL-909");
});

Deno.test("Multiple jira ticket in multiline string", async () => {
    const jiras = CallJiraAutomationWebhookFromString(`Verification thread for FOO-1234 and LOL-909
        
        oh and maybe this ticket too:
        HIP-8908`);
    assertEquals(jiras.length, 3);
    assertEquals(jiras[0], "FOO-1234");
    assertEquals(jiras[1], "LOL-909");
    assertEquals(jiras[2], "HIP-8908");
});