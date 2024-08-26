import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { getSlackMessageFromPermalink } from "./internals/slack_client.ts";
import { parseJiraIdsFromString } from "./internals/jira_helpers.ts";

/**
 * Functions are reusable building blocks of automation that accept
 * inputs, perform calculations, and provide outputs. Functions can
 * be used independently or as steps in workflows.
 * https://api.slack.com/automation/functions/custom
 */
export const ParseJiraIdsFunction = DefineFunction({
  callback_id: "parse_jira_ids_function",
  title: "Parse Jira Ids",
  description: "Takes a slack message permalink and parses Jira Ids",
  source_file: "functions/parse_jira_ids.ts",
  input_parameters: {
    properties: {
      messagesResponse: {
        type: Schema.types.string,
        description: "Link to the message to parse",
      },
    },
    required: ["messagesResponse"],
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
  ParseJiraIdsFunction,
  async ({ inputs, client }) => {
    console.log("String to parse:", inputs.messagesResponse);
    const slackPermalink = new URL(inputs.messagesResponse);
    const message = await getSlackMessageFromPermalink(client, slackPermalink);
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