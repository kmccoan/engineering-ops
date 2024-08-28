import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { getSlackMessageFromPermalinkm, getSlackUser } from "./internals/slack_client.ts";
import { parseJiraIdsFromSlackTextBody } from "./internals/jira_helpers.ts";
import { callJiraWebhookWithSlackMessageInfo, callJiraWebhookWithUserInfo } from "./internals/jira_client.ts";

/**
 * Functions are reusable building blocks of automation that accept
 * inputs, perform calculations, and provide outputs. Functions can
 * be used independently or as steps in workflows.
 * https://api.slack.com/automation/functions/custom
 */
export const UserTriggeredCallJiraAutomationWebhookFunction = DefineFunction({
  callback_id: "user_triggered_call_jira_automation_webhook_function",
  title: "Call Jira automation webhook from a user triggered event",
  description: "Takes a slack user and calls a Jira automation webhook",
  source_file: "functions/user_triggered_call_jira_automation_webhook.ts",
  input_parameters: {
    properties: {
      slackUserId: {
        type: Schema.types.string,
        description: "The user's id",
      },
      jiraAutomationWebhook: {
        type: Schema.types.string,
        description: "Domain must be: automation.atlassian.com",
      },
      jiraAutomationDocumentation: {
        type: Schema.types.string,
        description: "Url to Jira automation configuration",
      }
    },
    required: ["slackUserId", "jiraAutomationWebhook"],
  },
  output_parameters: {
    properties: {}
  },
});

export default SlackFunction(
  UserTriggeredCallJiraAutomationWebhookFunction,
  async ({ inputs, client }) => {
    try {
      new URL(inputs.jiraAutomationWebhook)
    } catch(e) {
      const error = `Malformed Jira automation webhook URL. Are you sure you have a properly constructed URL? Input was: ${inputs.jiraAutomationWebhook}`;
      console.log(error);
      return { error };
    }

    const slackUserId = inputs.slackUserId;
    console.log("Slack user Id:", slackUserId);
    if (!slackUserId.startsWith("U")) {
      return { error: `The input to this step needs to be the slack USER ID (change via click dropdown in workflow step user id field). Your input was ${slackUserId}` };
    }

    const slackUserResponse = await getSlackUser(client, slackUserId);

    if (slackUserResponse.error) {
      const error = `Failed to fetch the user due to ${slackUserResponse.error}.`;
      console.log(error);
      return { error };
    }
    
    const jiraAutomationWebhookUrl = new URL(inputs.jiraAutomationWebhook);
    try {
      const jiraResponse = await callJiraWebhookWithUserInfo(jiraAutomationWebhookUrl, slackUserResponse.user.id, slackUserResponse.user.profile.email, slackUserResponse.user.name);
      console.log(jiraResponse);
      if (jiraResponse.status != 200) {
        return { error: `Jira automation response was a ${jiraResponse.status}. Configuration is at ${inputs.jiraAutomationDocumentation}` };
      }
    } catch (e) {
      const error = `Failed to trigger automation. Error was ${e}. 
      
      Common problems:
      1. PermissionDenied - net access:
      Outgoing domain allowed: [automation.atlassian.com]. Your webhook url domain was "${jiraAutomationWebhookUrl.hostname}".
      Is your webook URL domain allowed?`;
      console.log(error);
      return { error };
    }

    return {
      outputs: {  },
    };
  },
);