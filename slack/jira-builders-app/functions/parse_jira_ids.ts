import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

/**
 * Functions are reusable building blocks of automation that accept
 * inputs, perform calculations, and provide outputs. Functions can
 * be used independently or as steps in workflows.
 * https://api.slack.com/automation/functions/custom
 */
export const ParseJiraIdsFunction = DefineFunction({
  callback_id: "parse_jira_ids_function",
  title: "Parse Jira Ids",
  description: "Takes a string and parses Jira Ids",
  source_file: "functions/parse_jira_ids.ts",
  input_parameters: {
    properties: {
      stringToParse: {
        type: Schema.types.string,
        description: "The string to parse for jira ids",
      },
    },
    required: ["stringToParse"],
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
    // Should be format https://ghostbusters.slack.com/archives/C1H9RESGA/p135854651500008
    // or "https://ghostbusters.slack.com/archives/C1H9RESGL/p135854651700023?thread_ts=1358546515.000008&cid=C1H9RESGL" (when threaded msg.)
    console.log("String to parse:", inputs.stringToParse);
    const slackPermalink = new URL(inputs.stringToParse);

    const pathParts = slackPermalink.pathname.split("/");
    const channelId = pathParts[2]; //C1H9RESGA
    const permalinkId = pathParts[3]; //p135854651500008
    const unformattedMessageTS = permalinkId.substring(1); //135854651500008
    console.log("channelId", channelId);
    console.log("permalinkId", permalinkId);
    console.log("unformattedMessageTS", unformattedMessageTS);
    if (unformattedMessageTS.indexOf('?') != -1) {
      unformattedMessageTS = unformattedMessageTS.substring(0, latest.indexOf('?'));
    }
   const messageTS = unformattedMessageTS.substring(0, unformattedMessageTS.length-6) + '.' + unformattedMessageTS.substring(unformattedMessageTS.length-6); //1358546515.00008
   console.log("messageTS", messageTS);

   await client.conversations.join({
    channel: channelId
  });

    const stringToParse = (await client.conversations.history({
      channel: channelId,
      latest: messageTS,
      limit: 1,
      inclusive: true,
    })).messages[0].text;

    console.log("string to parse: ", stringToParse);

    const jiraTicketIDRegex = /\b[A-Za-z]+-\d+\b/g;
    const jiraIdsArray = [...stringToParse.matchAll(jiraTicketIDRegex)];
    if (jiraIdsArray.length === 0 ) {
      console.log("here:");
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