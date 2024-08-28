import { Manifest } from "deno-slack-sdk/mod.ts";
import { CallJiraAutomationWebhookFunction } from "./functions/call_jira_automation_webhook.ts";
import { UserTriggeredCallJiraAutomationWebhookFunction } from "./functions/user_triggered_call_jira_automation_webhook.ts";

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "jira-builders-app",
  description: "A template for building standalone functions in Slack",
  icon: "assets/default_new_app_icon.png",
  functions: [CallJiraAutomationWebhookFunction, UserTriggeredCallJiraAutomationWebhookFunction],
  outgoingDomains: ["automation.atlassian.com"],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "channels:read",
    "channels:history",
    "channels:join",
    "users:read.email",
    "users:read"
  ],
});
