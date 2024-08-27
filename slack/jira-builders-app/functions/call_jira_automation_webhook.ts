import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { getSlackMessageFromPermalink } from "./internals/slack_client.ts";
import { parseJiraIdsFromString } from "./internals/jira_helpers.ts";

/**
 * Functions are reusable building blocks of automation that accept
 * inputs, perform calculations, and provide outputs. Functions can
 * be used independently or as steps in workflows.
 * https://api.slack.com/automation/functions/custom
 */
export const CallJiraAutomationWebhookFunction = DefineFunction({
  callback_id: "call_jira_automation_webhook_function",
  title: "Call Jira automation webhook",
  description: "Takes a slack message permalink, parses Jira Ids, and calls Jira automation webhook",
  source_file: "functions/call_jira_automation_webhook.ts",
  input_parameters: {
    properties: {
      messagePermalink: {
        type: Schema.types.string,
        description: "Link to the message to parse",
      },
    },
    required: ["messagePermalink"],
  },
  output_parameters: {
    properties: {
      jiraIds: {
        type: Schema.types.string,
        description: "Comma delimited list of Jira ids. ie: FOO-124,LOL-789 or `no-jiras-found`",
      },
    },
    required: ["jiraIds"],
  },
});

export default SlackFunction(
  CallJiraAutomationWebhookFunction,
  async ({ inputs, client }) => {
    console.log("String to parse:", inputs.messagePermalink);
    const slackPermalink = new URL(inputs.messagePermalink);
    const message = await getSlackMessageFromPermalink(client, slackPermalink);

    if (message.error) {
      const error = `Failed to fetch the message due to ${message.error}.`;
      console.log(error);
      return { error };
    }

    const jiraIdsArray = parseJiraIdsFromString(message);

    if (jiraIdsArray.length === 0) {
      console.log("no-jiras-found");
      return {
        outputs: {
          jiraIds: "no-jiras-found"
        },
      };
    }
    const jiraIds = jiraIdsArray.join(",");
    console.log("Jira ids:", jiraIds);
    return {
      outputs: { jiraIds },
    };
  },
);