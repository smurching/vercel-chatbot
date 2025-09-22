---
description: 'Learn how to create and deploy :re[DABS] in the workspace.'
last_update:
  date: 2025-08-12
---

# Tutorial: Create and deploy a bundle in the workspace

:::info[Preview]

:re[DABS] in the workspace is in [Public Preview](/release-notes/release-types.md).

:::

To help you get started using :re[DABS] in the workspace, this tutorial walks you through creating a bundle with a job, deploying it, and running the job in the bundle - all from the workspace.

For requirements for using bundles in the workspace, see [Databricks Asset Bundles in the workspace requirements](/dev-tools/bundles/workspace.md#requirements).

For more information about bundles, see [\_](/dev-tools/bundles/index.md).

## Create a bundle

First, create a bundle in the Databricks workspace:

1. Navigate to the Git folder where you want to create your bundle.
1. Click the **Create** button, then click **Asset bundle**. Alternatively, right click on the Git folder or its associated kebab in the workspace tree and click **Create** \> **Asset bundle**:

   ![Create an asset bundle](/images/bundles/create.png)

1. In the **Create an asset bundle** dialog, give the asset bundle a name, such as _totally-awesome-bundle_. The bundle name can only contain letters, numbers, dashes, and underscores. Select **Empty project** then click **Create and deploy** .

   ![Create new asset bundle dialog](/images/bundles/create-dialog.png)

This creates an initial bundle in the Git folder, which includes a `.gitignore` Git configuration file and the required :re[DABS] `databricks.yml` file. The `databricks.yml` file contains the main configuration for the bundle. For details, see [\_](/dev-tools/bundles/settings.md).

![New asset bundle](/images/bundles/new.png)

## Define a job that runs a notebook

Next, add a job to your bundle that runs a notebook. The notebook in the following example prints “Hello World!”.

1. Click the **Create notebook** bundle project tile. Alternatively, click the kebab for the bundle in the table of contents, and then click **Create** \> **Notebook**.
1. Rename the notebook to _helloworld_.
1. Set the language of the notebook to Python and paste the following into the cell of the notebook:

   ```python
   print("Hello World!")
   ```

1. Click the deployment icon for the bundle to switch to the **Deployments** panel.

   ![Deployments panel icon](/images/bundles/deployment-icon.png)

1. Under **Bundle resources**, click **Create**, then **Create new job definition**.

   ![Create job definition](/images/bundles/job-definition.png)

1. Type _run-notebook_ into the **Job name** field of the **Create job definition** dialog. Click **Create and deploy**. A job definition file `run-notebook.job.yml` is created, with basic YAML for the job, and some additional commented-out example YAML for a job.

1. Now add a notebook task to the job definition. Copy and paste the following YAML into the `run-notebook.job.yml` file, replacing the basic YAML:

   ```yaml
   resources:
     jobs:
       run_notebook:
         name: run-notebook
         queue:
           enabled: true
         tasks:
           - task_key: my-notebook-task
             notebook_task:
               notebook_path: ../helloworld.ipynb
   ```

   ![Job notebook task configuration YAML](/images/bundles/job-notebook.png)

For details about defining a job in YAML, see [\_](/dev-tools/bundles/resources.md#jobs). For YAML syntax for other supported job task types, see [\_](/dev-tools/bundles/job-task-types.md).

## Deploy the bundle

Next, deploy the bundle and run the job that contains the `helloworld` notebook task.

1. In the **Deployments** pane for the bundle for **Targets**, click the dropdown to select the `dev` target workspace if it is not already selected. Target workspaces are defined in the `targets` mapping of the bundle’s `databricks.yml`. See [\_](/dev-tools/bundles/deployment-modes.md).

   ![Choose target deployment](/images/bundles/target-deployment.png)

1. Click the **Deploy** button. The bundle is validated and details of the validation appear in a dialog.
1. Review the deployment details in this **Deploy to dev** confirmation dialog, then click **Deploy**.

   ![Deploy to dev dialog](/images/bundles/dev-deploy.png)

   :::important

   Deploying bundles and running bundle resources executes code as the current user. Make sure that you trust the code in the bundle, including YAML, which can contain configuration settings that run commands.

   :::

The status of the deployment is output to the **Project output** window.

## Run the job

Deployed bundle resources are listed under **Bundle resources**. Click the play icon associated with the job resource to run it.

![List deployed resources](/images/bundles/deployed-resources.png)

Navigate to **Job runs** from the left navigation bar to see the bundle run. The name of the bundle job run is prefixed, for example `[dev someone] run-notebook`.

## Next steps

- [\_](/dev-tools/bundles/workspace-author.md#add-existing)
- [\_](/dev-tools/bundles/workspace-deploy.md#share)
