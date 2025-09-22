---
description: 'Learn about :re[DABS] in the workspace.'
last_update:
  date: 2025-08-14
---

# Collaborate on bundles in the workspace

:::info[Preview]

:re[DABS] in the workspace is in [Public Preview](/release-notes/release-types.md).

:::

:re[DABS] are created, deployed to a workspace, then managed programmatically from your local development environment or directly in the workspace UI. Collaborating on bundles directly in the workspace allows for more rapid iteration and testing before moving to production.

For more information about bundles, see [\_](/dev-tools/bundles/index.md).

:::tip

If you don't want to use the workspace UI to create and manage your bundles, but would still like to develop bundles in the workspace, you can use the Databricks CLI from the workspace web terminal, just as you would from your local terminal. See [\_](/compute/web-terminal.md#cli-workspace).

:::

## <a id="requirements"></a>What are the installation requirements of bundles in the workspace?

You do not have to install anything locally to use bundles in the workspace, but there are Databricks workspace requirements:

- Workspace files must be enabled. See [\_](/files/workspace.md).
- You must have a Git folder in which to create the bundle. To create a Git folder, see [\_](/repos/git-operations-with-repos.md#clone-repo).
- Serverless compute must be enabled. See [\_](/admin/workspace-settings/serverless.md).
- Bundles in the workspace are not compatible with SEG.

The version of the Databricks CLI used to deploy a bundle and run resources in the workspace is provided in the **Deploy** dialog.

## Do I have to understand how to author YAML to use bundles in the workspace?

No. :re[DABS] in the workspace provides a UI for managing bundles so that you can collaborate on bundles that were developed by other users in their local development environments. You do not need to learn YAML or know how to use the Databricks CLI to work with bundles in the workspace.

## I already manage my workflows in the Databricks UI. Why should I use bundles?

:re[DABS] allows you to source control all of the files needed for your workflows. Bundles in the workspace provides a mechanism for workspace users to edit, commit, test, and deploy updates through the UI. Users launch a bundle project from within a Git folder.

## I have a bundle in a GitHub repository. How can I edit it in the Databricks workspace?

A folder is identified as a bundle by Databricks if a `databricks.yml` file exists at the root of the folder. Create a Git folder in Databricks for your GitHub repository, and Databricks will recognize it as a bundle.

## Is all bundle configuration supported in the workspace?

Almost all of your existing bundles can be managed in the workspace. However, [Python for Databricks Asset Bundles](/dev-tools/bundles/python/index.md) is not currently supported in the workspace.

## How do I share a bundle for collaboration?

Bundles inherit the permissions of their parent Git folder, so to share a bundle, share the Git folder that contains your bundle project with your collaborators. See [\_](/dev-tools/bundles/workspace-deploy.md#share).

## How can I move a bundle to production in the workspace?

Bundles define a complete project to deploy, the infrastructure necessary to run the project, and the workspaces to target for deployments. These target workspaces are typically your development, staging and production environments. :re[DABS] in the workspace makes it easy to switch targets, deploy, and run workflows from the UI. See [\_](/dev-tools/bundles/workspace-deploy.md).

## Learn more

- [\_](/dev-tools/bundles/workspace-tutorial.md)
- [\_](/dev-tools/bundles/workspace-author.md)
- [\_](/dev-tools/bundles/workspace-deploy.md)
