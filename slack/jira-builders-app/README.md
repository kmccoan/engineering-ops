# Deno Function Template

This is a template used to build out a single, workflow-less function. To learn
more, read the tutorial on creating
[custom functions for Workflow Builder](https://api.slack.com/tutorials/tracks/wfb-function).

**Guide Outline**:

- [Setup](#setup)
  - [Install the Slack CLI](#install-the-slack-cli)
  - [Clone the Template](#clone-the-template)
- [Running Your Project Locally](#running-your-project-locally)
- [Testing](#testing)
- [Deploying Your App](#deploying-your-app)
- [Viewing Activity Logs](#viewing-activity-logs)
- [Adding Function to Workflow Builder](#adding-function-to-workflow-builder)
- [Project Structure](#project-structure)
- [Resources](#resources)

---

## Setup

Before getting started, first make sure you have a development workspace where
you have permission to install apps. **Please note that the features in this
project require that the workspace be part of
[a Slack paid plan](https://slack.com/pricing).**

### Install the Slack CLI

To use this template, you need to install and configure the Slack CLI.
Step-by-step instructions can be found in our
[Quickstart Guide](https://api.slack.com/automation/quickstart).

### Clone the Template

Start by cloning this repository:

```zsh
# Clone this project onto your machine
$ slack create my-app -t slack-samples/deno-function-template

# Change into the project directory
$ cd my-app
```

## Running Your Project Locally

While building your app, you can see your changes appear in your workspace in
real-time with `slack run`. You'll know an app is the development version if the
name has the string `(local)` appended.

```zsh
# Run app locally
$ slack run

Connected, awaiting events
```

To stop running locally, press `<CTRL> + C` to end the process.

## Testing

Run all tests with `deno test`:

```zsh
$ deno test
```

## Deploying Your App

Once development is complete, deploy the app to Slack infrastructure using
`slack deploy`:

```zsh
$ slack deploy
```

### Deploying Triggers
When deploying for the first time, you'll be prompted to
[create a new link trigger](#creating-triggers) for the deployed version of your
app. When that trigger is invoked, the workflow should run just as it did when
developing locally (but without requiring your server to be running).

Triggers are what cause workflows to run. These triggers can be invoked by a user, or automatically as a response to an event within Slack.

When you run or deploy your project for the first time, the CLI will prompt you to create a trigger if one is found in the triggers/ directory. For any subsequent triggers added to the application, each must be manually added using the trigger create command.

When creating triggers, you must select the workspace and environment that you'd like to create the trigger in. Each workspace can have a local development version (denoted by (local)), as well as a deployed version. Triggers created in a local environment will only be available to use when running the application locally.

```sh
slack trigger create --trigger-def <todo>
```

## Viewing Activity Logs

Activity logs of your application can be viewed live and as they occur with the
following command:

```zsh
$ slack activity --tail
```

## Adding Function to Workflow Builder

This function can be used in
[Workflow Builder](https://slack.com/help/articles/16962850225939-Build-a-workflow)
once the app is installed to your workspace (either through `slack run` or
`slack deploy`). To access Workflow Builder, you can go to the "Tools" option
under your workspace and select "Workflow Builder".

From here, you can create a new workflow. Functions from installed apps can be
added as a step within Workflow Builder; to add it, search for your app name in
the "Steps" sidebar when you're building out your new workflow and you should
see the app's related functions show up in the results. You can select this
option and fill out the needed inputs to pass into the function. At this point,
the function will be added as a step in your workflow!

## Project Structure

### `.slack/`

Contains `apps.dev.json` and `apps.json`, which include installation details for
development and deployed apps.

### `functions/`

[Functions](https://api.slack.com/automation/functions) are reusable building
blocks of automation that accept inputs, perform calculations, and provide
outputs. Functions can be used independently or as steps in workflows.

### `manifest.ts`

The [app manifest](https://api.slack.com/automation/manifest) contains the app's
configuration. This file defines attributes like app name and description.

### `slack.json`

Used by the CLI to interact with the project's SDK dependencies. It contains
script hooks that are executed by the CLI and implemented by the SDK.

## Resources

To learn more about developing automations on Slack, visit the following:

- [Automation Overview](https://api.slack.com/automation)
- [CLI Quick Reference](https://api.slack.com/automation/cli/quick-reference)
- [Samples and Templates](https://api.slack.com/automation/samples)
