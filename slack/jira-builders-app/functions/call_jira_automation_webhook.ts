import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { getSlackMessageFromPermalink } from "./internals/slack_client.ts";
import { parseJiraIdsFromSlackTextBody } from "./internals/jira_helpers.ts";
import { callJiraWebhook } from "./internals/jira_client.ts";

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
      jiraAutomationWebhook: {
        type: Schema.types.string,
        description: "Jira automation webhook",
      },
      jiraAutomationDocumentation: {
        type: Schema.types.string,
        description: "Url to Jira automation configuration",
      }
    },
    required: ["messagePermalink", "jiraAutomationWebhook"],
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
    try {
      new URL(inputs.jiraAutomationWebhook)
    } catch(e) {
      const error = `Malformed Jira automation webhook URL. Are you sure you have a properly constructed URL? Input was: ${inputs.jiraAutomationWebhook}`;
      console.log(error);
      return { error };
    }
    console.log("String to parse:", inputs.messagePermalink);
    const slackPermalink = new URL(inputs.messagePermalink);
    const message = await getSlackMessageFromPermalink(client, slackPermalink);

    if (message.error) {
      const error = `Failed to fetch the message due to ${message.error}.`;
      console.log(error);
      return { error };
    }

    const jiraIdsArray = parseJiraIdsFromSlackTextBody(message);

    if (jiraIdsArray.length === 0) {
      console.log("no-jiras-found");
      return {
        outputs: {
          jiraIds: "no-jiras-found"
        },
      };
    }

    const jiraResponse = await callJiraWebhook(new URL(inputs.jiraAutomationWebhook), jiraIdsArray, slackPermalink);

    console.log(jiraResponse);


    const jiraIds = jiraIdsArray.join(",");
    console.log("Jira ids:", jiraIds);
    return {
      outputs: { jiraIds },
    };
  },
);