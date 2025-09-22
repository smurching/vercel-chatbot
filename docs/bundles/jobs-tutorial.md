---
description: 'Complete a hands-on tutorial that demonstrates how to use :re[DABS] to work with jobs in Databricks.'
last_update:
  date: 2025-07-03
---

# Develop a job with :re[DABS]

:re[DABS], also known simply as _bundles_, contain the artifacts you want to deploy and the settings for :re[Databricks] resources such as jobs that you want to run, and enable you to programmatically validate, deploy, and run them. See [\_](/dev-tools/bundles/index.md).

This article describes how to create a bundle to programmatically manage a job. See [\_](/jobs/index.md). The bundle is created using the :re[DABS] default bundle template for Python, which consists of a notebook paired with the definition of a job to run it. You then validate, deploy, and run the deployed job in your :re[Databricks] workspace.

:::tip

If you have existing jobs that were created using the Lakeflow Jobs user interface or API that you want to move to bundles, you must define them in a bundle's configuration files. Databricks recommends that you first create a bundle using the steps below and then validate whether the bundle works. You can then add additional job definitions, notebooks, and other sources to the bundle. See [\_](/dev-tools/bundles/migrate-resources.md#existing-job).

:::

## Requirements

- Databricks CLI version 0.218.0 or above. To check your installed version of the Databricks CLI, run the command `databricks -v`. To install the Databricks CLI, see [\_](/dev-tools/cli/install.md).
- The remote Databricks workspace must have workspace files enabled. See [\_](/files/workspace.md).

## Create a bundle using a project template

First, create a bundle using the :re[DABS] default Python template. For more information about bundle templates, see [\_](/dev-tools/bundles/templates.md).

If you want to create a bundle from scratch, see [\_](/dev-tools/bundles/manual-bundle.md).

### Step 1: Set up authentication

In this step, you set up authentication between the Databricks CLI on your development machine and your :re[Databricks] workspace. This article assumes that you want to use OAuth user-to-machine (U2M) authentication and a corresponding :re[Databricks] configuration profile named `DEFAULT` for authentication.

:::note

U2M authentication is appropriate for trying out these steps in real time. For fully automated workflows, Databricks recommends that you use OAuth machine-to-machine (M2M) authentication instead. See the M2M authentication setup instructions in [\_](/dev-tools/auth/oauth-m2m.md).

:::

::include[dev-tools/oauth-u2m-setup-cli-workspace.md]

### Step 2: Initialize the bundle

Initialize a bundle using the default Python bundle project template.

:::note

The default-python template requires that `uv` is installed. See [Installing uv](https://docs.astral.sh/uv/getting-started/installation/).

:::

1. Use your terminal or command prompt to switch to a directory on your local development machine that will contain the template's generated bundle.
1. Use the Databricks CLI to run the `bundle init` command:

   ```bash
   databricks bundle init
   ```

1. For `Template to use`, leave the default value of `default-python` by pressing `Enter`.
1. For `Unique name for this project`, leave the default value of `my_project`, or type a different value, and then press `Enter`. This determines the name of the root directory for this bundle. This root directory is created in your current working directory.
1. For `Include a stub (sample) notebook`, select `yes` and press `Enter`.
1. For `Include a stub (sample) Delta Live Tables pipeline`, select `no` and press `Enter`. This instructs the Databricks CLI to not define a sample ETL pipeline in your bundle.
1. For `Include a stub (sample) Python package`, select `no` and press `Enter`. This instructs the Databricks CLI to not add sample Python wheel package files or related build instructions to your bundle.
1. For `Use serverless`, select `yes` and press `Enter`. This instructs the Databricks CLI to configure your bundle to run on serverless compute.

### Step 3: Explore the bundle

To view the files that the template generated, switch to the root directory of your newly created bundle. Files of particular interest include the following:

- `databricks.yml`: This file specifies the bundle's programmatic name, includes a reference to the job definition, and specifies settings about the target workspace.
- `resources/<project-name>_job.yml`: This file specifies the job's settings, including a default notebook task.
- `src/notebook.ipynb`: This file is a sample notebook that, when run, simply initializes an RDD that contains the numbers 1 through 10.

For customizing jobs, the mappings in a job declaration correspond to the request payload, expressed in YAML format, of the create job operation as documented in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference.

:::tip

You can define, combine, and override the settings for new job clusters in bundles by using the techniques described in [\_](/dev-tools/bundles/cluster-override.md).

:::

### Step 4: Validate the project's bundle configuration file

In this step, you check whether the bundle configuration is valid.

1. From the root directory, use the Databricks CLI to run the `bundle validate` command, as follows:

   ```bash
   databricks bundle validate
   ```

1. If a summary of the bundle configuration is returned, then the validation succeeded. If any errors are returned, fix the errors, and then repeat this step.

If you make any changes to your bundle after this step, you should repeat this step to check whether your bundle configuration is still valid.

### Step 5: Deploy the local project to the remote workspace

In this step, you deploy the local notebook to your remote :re[Databricks] workspace and create the :re[Databricks] job within your workspace.

1. From the bundle root, use the Databricks CLI to run the `bundle deploy` command as follows:

   ```bash
   databricks bundle deploy -t dev
   ```

1. Check whether the local notebook was deployed: In your :re[Databricks] workspace's sidebar, click **Workspace**.
1. Click into the **Users \> `<your-username>` \> .bundle \> `<project-name>` \> dev \> files \> src** folder. The notebook should be in this folder.
1. Check whether the job was created: In your :re[Databricks] workspace's sidebar, click **Jobs & Pipelines**.
1. On the **Jobs & Pipelines** tab, click **[dev `<your-username>`] `<project-name>_job`**.

   If the list is long, you can filter to **Jobs**, and **Owned by me**.

1. Click the **Tasks** tab. There should be one task: **notebook_task**.

If you make any changes to your bundle after this step, you should repeat steps 4-5 to check whether your bundle configuration is still valid and then redeploy the project.

### Step 6: Run the deployed project

In this step, you trigger a run of the job in your workspace from the command line.

1. From the root directory, use the Databricks CLI to run the `bundle run` command, as follows, replacing `<project-name>` with the name of your project from Step 2:

   ```bash
   databricks bundle run -t dev <project-name>_job
   ```

1. Copy the value of `Run URL` that appears in your terminal and paste this value into your web browser to open your :re[Databricks] workspace. See [\_](/jobs/monitor.md#view-dabs-jobs)
1. In your :re[Databricks] workspace, after the job task completes successfully and shows a green title bar, click the job task to see the results.

If you make any changes to your bundle after this step, you should repeat steps 4-6 to check whether your bundle configuration is still valid, redeploy the project, and run the redeployed project.

### Step 7: Clean up

In this step, you delete the deployed notebook and the job from your workspace.

1. From the root directory, use the Databricks CLI to run the `bundle destroy` command, as follows:

   ```bash
   databricks bundle destroy -t dev
   ```

1. Confirm the job deletion request: When prompted to permanently destroy resources, type `y` and press `Enter`.
1. Confirm the notebook deletion request: When prompted to permanently destroy the previously deployed folder and all of its files, type `y` and press `Enter`.
1. If you also want to delete the bundle from your development machine, you can now delete the local directory from Step 2.
