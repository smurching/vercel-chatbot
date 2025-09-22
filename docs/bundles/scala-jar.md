---
description: 'Learn how to build and deploy a Scala JAR using :re[DABS].'
last_update:
  date: 2025-06-18
---

# Build a Scala JAR using :re[DABS]

This article describes how to build, deploy, and run a Scala JAR with :re[DABS]. For information about bundles, see [\_](/dev-tools/bundles/index.md).

For example configuration that builds a Java JAR and uploads it to :re[UC], see [\_](/dev-tools/bundles/examples.md#jar-upload).

## Requirements

- Databricks CLI version 0.218.0 or above, and authentication is configured. To check your installed version of the Databricks CLI, run the command `databricks -v`. To install the Databricks CLI, see [\_](/dev-tools/cli/install.md). To configure authentication, see [\_](/dev-tools/cli/tutorial.md#auth).
- You must have a :re[UC] volume in Databricks where you want to store the build artifacts, and permissions to upload the JAR to a specified volume path. See [\_](/volumes/utility-commands.md).

## <a id="create-bundle"></a>Step 1: Create the bundle

First, create the bundle using the [bundle init command](/dev-tools/cli/bundle-commands.md#init) and the Scala project bundle template. The Scala JAR bundle template creates a bundle that builds a JAR, uploads it to the specified volume, and defines a job with a Spark task with the JAR that runs on a specified cluster. The Scala in the template project defines a UDF that applies a simple transformation to a sample DataFrame and outputs the results. The source for the template is in the [bundle-examples repository](https://github.com/databricks/bundle-examples/tree/main/contrib/templates/scala-job).

1. Run the following command in a terminal window on your local development machine. It prompts for the value of some required fields.

   ```bash
   databricks bundle init --template-dir contrib/templates/scala-job https://github.com/databricks/bundle-examples
   ```

1. For a name for the project, enter `my_scala_project`. This determines the name of the root directory for this bundle. This root directory is created within your current working directory.
1. For volumes destination path, provide the :re[UC] volumes path in Databricks where you want the bundle directory to be created that will contain the JAR and other artifacts, for example `/Volumes/my-catalog/my-schema/bundle-volumes`.

   :::note

   Depending on your workspace permissions, your admin may need to allowlist the Volumes JAR path you specify. See [\_](/data-governance/unity-catalog/manage-privileges/allowlist.md).

   :::

## Step 2: Explore the bundle

To view the files that the template generated, switch to the root directory of your newly created bundle and open this directory with your preferred IDE. Files of particular interest include the following:

- `databricks.yml`: This file specifies the bundle's programmatic name, includes a reference to the job definition, and specifies settings about the target workspace.
- `resources/my_scala_project.job.yml`: This file specifies the job's JAR task and cluster settings.
- `src/`: This directory includes the source files for the Scala project.
- `build.sbt`: This file contains important build and dependent library settings.
- `README.md`: This file contains these getting started steps, and local build instructions and settings.

## Step 3: Validate the project's bundle configuration file

Next, check whether the bundle configuration is valid using the [bundle validate command](/dev-tools/cli/bundle-commands.md#validate).

1. From the root directory, run the Databricks CLI `bundle validate` command. Among other checks, this verifies that the volume specified in the configuration file exists in the workspace.

   ```bash
   databricks bundle validate
   ```

1. If a summary of the bundle configuration is returned, then the validation succeeded. If any errors are returned, fix the errors, then repeat this step.

If you make any changes to your bundle after this step, repeat this step to check whether your bundle configuration is still valid.

## Step 4: Deploy the local project to the remote workspace

Now deploy the bundle to your remote :re[Databricks] workspace using the [bundle deploy command](/dev-tools/cli/bundle-commands.md#deploy). This step builds the JAR file and uploads it to the specified volume.

1. Run the Databricks CLI `bundle deploy` command:

   ```bash
   databricks bundle deploy -t dev
   ```

1. To check whether the locally built JAR file was deployed:

   1. In your :re[Databricks] workspace's sidebar, click **Catalog Explorer**.
   1. Navigate to the volume destination path you specified when you initialized the bundle. The JAR file should be located in the following folder inside that path: `/my_scala_project/dev/<user-name>/.internal/`.

1. To check whether the job was created:

   1. In your :re[Databricks] workspace's sidebar, click **Jobs & Pipelines**.
   1. Optionally, select the **Jobs** and **Owned by me** filters.
   1. Click **[dev `<your-username>`] `my_scala_project`**.
   1. Click the **Tasks** tab.

   There should be one task: **main_task**.

If you make any changes to your bundle after this step, repeat the validation and deployment steps.

## Step 5: Run the deployed project

Finally, run the :re[Databricks] job using the [bundle run command](/dev-tools/cli/bundle-commands.md#run).

1. From the root directory, run the Databricks CLI `bundle run` command, specifying the name of the job in the definition file `my_scala_project.job.yml`:

   ```bash
   databricks bundle run -t dev my_scala_project
   ```

1. Copy the value of `Run URL` that appears in your terminal and paste this value into your web browser to open your :re[Databricks] workspace.
1. In your :re[Databricks] workspace, after the task completes successfully and shows a green title bar, click the **main_task** task to see the results.
