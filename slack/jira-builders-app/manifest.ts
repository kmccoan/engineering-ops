import { Manifest } from "deno-slack-sdk/mod.ts";
import { SampleFunctionDefinition } from "./functions/sample_function.ts";
import { ParseJiraIdsFunction } from "./functions/parse_jira_ids.ts";

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "jira-builders-app",
  description: "A template for building standalone functions in Slack",
  icon: "assets/default_new_app_icon.png",
  functions: [SampleFunctionDefinition,ParseJiraIdsFunction],
  outgoingDomains: [],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "channels:read",
    "channels:history",
    "channels:join"
  ],
});
