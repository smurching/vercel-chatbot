---
description: 'Complete a hands-on tutorial that demonstrates how to use :re[DABS] to work with :re[LDP].'
last_update:
  date: 2025-07-03
---

# Develop :re[LDP] with :re[DABS]

:re[DABS], also known simply as _bundles_, enable you to programmatically validate, deploy, and run :re[Databricks] resources such as :re[LDP]. See [\_](/dev-tools/bundles/index.md).

This article describes how to create a bundle to programmatically manage a pipeline. See [\_](/dlt/index.md). The bundle is created using the :re[DABS] default bundle template for Python, which consists of a notebook paired with the definition of a pipeline and job to run it. You then validate, deploy, and run the deployed pipeline in your :re[Databricks] workspace.

:::tip

If you have existing pipelines that were created using the :re[Databricks] user interface or API that you want to move to bundles, you must define them in a bundle's configuration files. Databricks recommends that you first create a bundle using the steps below and then validate whether the bundle works. You can then add additional definitions, notebooks, and other sources to the bundle. See [\_](/dev-tools/bundles/migrate-resources.md#existing-pipeline).

:::

## Requirements

- Databricks CLI version 0.218.0 or above. To check your installed version of the Databricks CLI, run the command `databricks -v`. To install the Databricks CLI, see [\_](/dev-tools/cli/install.md).
- The remote workspace must have workspace files enabled. See [\_](/files/workspace.md).

### (Optional) Install a Python module to support local pipeline development

Databricks provides a Python module to assist your local development of :re[LDP] code by providing syntax checking, autocomplete, and data type checking as you write code in your IDE.

The Python module for local development is available on PyPi. To install the module, see [Python stub for Lakeflow Declarative Pipelines](https://pypi.org/project/databricks-dlt/).

## Create a bundle using a project template

Create the bundle using the :re[Databricks] default bundle template for Python. This template consists of a notebook that defines an ETL pipeline (using :re[LDP]), which filters data from the original dataset. For more information about bundle templates, see [\_](/dev-tools/bundles/templates.md).

If you want to create a bundle from scratch, see [\_](/dev-tools/bundles/manual-bundle.md).

### Step 1: Set up authentication

In this step, you set up authentication between the Databricks CLI on your development machine and your :re[Databricks] workspace. This article assumes that you want to use OAuth user-to-machine (U2M) authentication and a corresponding :re[Databricks] configuration profile named `DEFAULT` for authentication.

:::note

U2M authentication is appropriate for trying out these steps in real time. For fully automated workflows, Databricks recommends that you use OAuth machine-to-machine (M2M) authentication instead. See the M2M authentication setup instructions in [\_](/dev-tools/auth/oauth-m2m.md).

:::

::include[dev-tools/oauth-u2m-setup-cli-workspace.md]

### Step 2: Create the bundle

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
1. For `Unique name for this project`, leave the default value of `my_project`, or type a different value, and then press `Enter`. This determines the name of the root directory for this bundle. This root directory is created within your current working directory.
1. For `Include a stub (sample) notebook`, select `no` and press `Enter`. This instructs the Databricks CLI to not add a sample notebook at this point, as the sample notebook that is associated with this option has no :re[LDP] code in it.
1. For `Include a stub (sample) Delta Live Tables pipeline`, leave the default value of `yes` by pressing `Enter`. This instructs the Databricks CLI to add a sample notebook that has :re[LDP] code in it.
1. For `Include a stub (sample) Python package`, select `no` and press `Enter`. This instructs the Databricks CLI to not add sample Python wheel package files or related build instructions to your bundle.
1. For `Use serverless`, select `yes` and press `Enter`. This instructs the Databricks CLI to configure your bundle to run on serverless compute.

### Step 3: Explore the bundle

To view the files that the template generated, switch to the root directory of your newly created bundle. Files of particular interest include the following:

- `databricks.yml`: This file specifies the bundle's programmatic name, includes a reference to the pipeline definition, and specifies settings about the target workspace.
- `resources/<project-name>_job.yml` and `resources/<project-name>_pipeline.yml`: These files define the job that contains a pipeline refresh task, and the pipeline's settings.
- `src/dlt_pipeline.ipynb`: This file is a notebook that, when run, executes the pipeline.

For customizing pipelines, the mappings within a pipeline declaration correspond to the create pipeline operation's request payload as defined in [POST /api/2.0/pipelines](https://docs.databricks.com/api/workspace/pipelines/create) in the REST API reference, expressed in YAML format.

### Step 4: Validate the project's bundle configuration file

In this step, you check whether the bundle configuration is valid.

1. From the root directory, use the Databricks CLI to run the `bundle validate` command, as follows:

   ```bash
   databricks bundle validate
   ```

1. If a summary of the bundle configuration is returned, then the validation succeeded. If any errors are returned, fix the errors, and then repeat this step.

If you make any changes to your bundle after this step, you should repeat this step to check whether your bundle configuration is still valid.

### Step 5: Deploy the local project to the remote workspace

In this step, you deploy the local notebook to your remote :re[Databricks] workspace and create the pipeline within your workspace.

1. From the bundle root, use the Databricks CLI to run the `bundle deploy` command as follows:

   ```bash
   databricks bundle deploy -t dev
   ```

1. Check whether the local notebook was deployed: In your :re[Databricks] workspace's sidebar, click **Workspace**.
1. Click into the **Users \> `<your-username>` \> .bundle \> `<project-name>` \> dev \> files \> src** folder. The notebook should be in this folder.
1. Check whether your pipeline was created:
   1. In your :re[Databricks] workspace's sidebar, click **Jobs & Pipelines**.
   1. Optionally, select the **Pipelines** and **Owned by me** filters.
   1. Click **[dev `<your-username>`] `<project-name>`\_pipeline**.

If you make any changes to your bundle after this step, you should repeat steps 4-5 to check whether your bundle configuration is still valid and then redeploy the project.

### Step 6: Run the deployed project

In this step, you trigger a run of the pipeline in your workspace from the command line.

1. From the root directory, use the Databricks CLI to run the `bundle run` command, as follows, replacing `<project-name>` with the name of your project from Step 2:

   ```bash
   databricks bundle run -t dev <project-name>_pipeline
   ```

1. Copy the value of `Update URL` that appears in your terminal and paste this value into your web browser to open your :re[Databricks] workspace.
1. In your :re[Databricks] workspace, after the pipeline completes successfully, click the **taxi_raw** view and the **filtered_taxis** :re[mv] to see the details.

If you make any changes to your bundle after this step, you should repeat steps 4-6 to check whether your bundle configuration is still valid, redeploy the project, and run the redeployed project.

### Step 7: Clean up

In this step, you delete the deployed notebook and the pipeline from your workspace.

1. From the root directory, use the Databricks CLI to run the `bundle destroy` command, as follows:

   ```bash
   databricks bundle destroy -t dev
   ```

1. Confirm the pipeline deletion request: When prompted to permanently destroy resources, type `y` and press `Enter`.
1. Confirm the notebook deletion request: When prompted to permanently destroy the previously deployed folder and all of its files, type `y` and press `Enter`.
1. If you also want to delete the bundle from your development machine, you can now delete the local directory from Step 2.
