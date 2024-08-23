import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { assertEquals } from "https://deno.land/std@0.153.0/testing/asserts.ts";
import ParseJiraIdsFunction from "./parse_jira_ids.ts";

const { createContext } = SlackFunctionTester("parse_jira_ids_function");

Deno.test("Single jira ticket in simple string", async () => {
    const inputs = { stringToParse: "Verification thread for FOO-1234" };
    const { outputs } = await ParseJiraIdsFunction(createContext({ inputs }));
    assertEquals(outputs?.jiraIds, "FOO-1234");
});

Deno.test("Multiple jira ticket in simple string", async () => {
    const inputs = { stringToParse: "Verification thread for FOO-1234 and LOL-909" };
    const { outputs } = await ParseJiraIdsFunction(createContext({ inputs }));
    assertEquals(outputs?.jiraIds, "FOO-1234,LOL-909");
});

Deno.test("Multiple jira ticket in multiline string", async () => {
    const inputs = {
        stringToParse: `Verification thread for FOO-1234 and LOL-909
        
        oh and maybe this ticket too:
        HIP-8908`
    };
    const { outputs } = await ParseJiraIdsFunction(createContext({ inputs }));
    assertEquals(outputs?.jiraIds, "FOO-1234,LOL-909,HIP-8908");
});