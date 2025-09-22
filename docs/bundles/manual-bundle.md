---
description: 'Create a Databricks Asset Bundle from scratch.'
last_update:
  date: 2025-07-03
---

# Create a bundle manually

In this tutorial, you create a Databricks Asset Bundle from scratch. This simple bundle consists of two notebooks and the definition of :re[a Databricks] job to run these notebooks. You then validate, deploy, and run the job in your :re[Databricks] workspace. These steps automate the quickstart titled [\_](/jobs/jobs-quickstart.md).

## Requirements

- Databricks CLI version 0.218.0 or above. To check your installed version of the Databricks CLI, run the command `databricks -v`. To install the Databricks CLI, see [\_](/dev-tools/cli/install.md).
- Authentication configured for the Databricks CLI. U2M authentication is appropriate for trying out these steps in real time. See [\_](/dev-tools/cli/authentication.md).
- The remote Databricks workspace must have workspace files enabled. See [\_](/files/workspace.md).

## Step 1: Create the bundle

A bundle contains the artifacts you want to deploy and the settings for the resources you want to run.

1. Create or identify an empty directory on your development machine.
1. Switch to the empty directory in your terminal or open it in your IDE.

:::tip

You can also use a directory containing a repository cloned from a Git provider. This enables you to manage your bundle with external version control and more easily collaborate with other developers and IT professionals on your project.

If you choose to clone a repo for this demo, Databricks recommends that the repo is empty or has only basic files in it such as `README` and `.gitignore`. Otherwise, any pre-existing files in the repo might be unnecessarily synchronized to your :re[Databricks] workspace.

:::

## Step 2: Add notebooks to the project

In this step, you add two notebooks to your project. The first notebook gets a list of trending baby names since 2007 from the New York State Department of Health's public data sources. See [Baby Names: Trending by Name: Beginning 2007](https://health.data.ny.gov/Health/Baby-Names-Beginning-2007/jxy9-yhdk) on the department's website. The first notebook then saves this data to your :re[Databricks] :re[UC] volume named `my-volume` in a schema named `default` in a catalog named `main`. The second notebook queries the saved data and displays aggregated counts of the baby names by first name and sex for 2014.

1. From the directory's root, create the first notebook, a file named `retrieve-baby-names.py`.
1. Add the following code to the `retrieve-baby-names.py` file:

   ```python
   # Databricks notebook source
   import requests

   response = requests.get('http://health.data.ny.gov/api/views/jxy9-yhdk/rows.csv')
   csvfile = response.content.decode('utf-8')
   dbutils.fs.put("/Volumes/main/default/my-volume/babynames.csv", csvfile, True)
   ```

1. Create the second notebook, a file named `filter-baby-names.py`, in the same directory.
1. Add the following code to the `filter-baby-names.py` file:

   ```python
   # Databricks notebook source
   babynames = spark.read.format("csv").option("header", "true").option("inferSchema", "true").load("/Volumes/main/default/my-volume/babynames.csv")
   babynames.createOrReplaceTempView("babynames_table")
   years = spark.sql("select distinct(Year) from babynames_table").toPandas()['Year'].tolist()
   years.sort()
   dbutils.widgets.dropdown("year", "2014", [str(x) for x in years])
   display(babynames.filter(babynames.Year == dbutils.widgets.get("year")))
   ```

## Step 3: Add a bundle configuration schema file to the project

If you are using an IDE such as Visual Studio Code, PyCharm Professional, or IntelliJ IDEA Ultimate that supports YAML files and JSON schema files, you can use your IDE to not only create the bundle configuration schema file but to check your project's bundle configuration file syntax and formatting.

:::::tabs

::::tab-item[Visual&nbsp;Studio&nbsp;Code]

1. Add YAML language server support to :re[VSC], for example by installing the [YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) extension from the Visual Studio Code Marketplace.
1. Generate the Databricks Asset Bundle configuration JSON schema file by using the Databricks CLI to run the `bundle schema` command and redirect the output to a JSON file. For example, generate a file named `bundle_config_schema.json` in the current directory, as follows:

   ```bash
   databricks bundle schema > bundle_config_schema.json
   ```

1. In Step 4 you will add the following comment to the beginning of your bundle configuration file, which associates your bundle configuration file with the specified JSON schema file:

   ```yaml
   # yaml-language-server: $schema=bundle_config_schema.json
   ```

   :::note

   In the preceding comment, if your Databricks Asset Bundle configuration JSON schema file is in a different path, replace `bundle_config_schema.json` with the full path to your schema file.

   :::

::::

:::tab-item[PyCharm&nbsp;Professional]

1. Generate the Databricks Asset Bundle configuration JSON schema file using the Databricks CLI to run the `bundle schema` command and redirect the output to a JSON file. For example, generate a file named `bundle_config_schema.json` in the current directory, as follows:

   ```bash
   databricks bundle schema > bundle_config_schema.json
   ```

1. Configure PyCharm to recognize the bundle configuration JSON schema file, and then complete the JSON schema mapping, by following the instructions in [Configure a custom JSON schema](https://www.jetbrains.com/help/pycharm/json.html#ws_json_schema_add_custom_procedure).
1. In Step 4 you will use PyCharm to create or open a bundle configuration file. By convention, this file is named `databricks.yml`.

:::

:::tab-item[IntelliJ&nbsp;IDEA&nbsp;Ultimate]

1. Generate the Databricks Asset Bundle configuration JSON schema file by using the Databricks CLI to run the `bundle schema` command and redirect the output to a JSON file. For example, generate a file named `bundle_config_schema.json` in the current directory, as follows:

   ```bash
   databricks bundle schema > bundle_config_schema.json
   ```

1. Configure IntelliJ IDEA to recognize the bundle configuration JSON schema file, and then complete the JSON schema mapping, by following the instructions in [Configure a custom JSON schema](https://www.jetbrains.com/help/idea/json.html#ws_json_schema_add_custom_procedure).
1. In Step 4 you will use IntelliJ IDEA to create or open a bundle configuration file. By convention, this file is named `databricks.yml`.

:::

:::::

## Step 4: Add a bundle configuration file to the project

In this step, you define how to deploy and run the two notebooks. For this demo, you want to use :re[a Databricks] job to run the first notebook and then the second notebook. Because the first notebook saves the data and the second notebook queries the saved data, you want the first notebook to finish running before the second notebook starts. You model these objectives in a bundle configuration file in your project.

1. From the directory's root, create the bundle configuration file, a file named `databricks.yml`.
1. Add the following code to the `databricks.yml` file, replacing `<workspace-url>` with your :re[get-workspace-url]. This URL must match the one in your `.databrickscfg` file:

:::tip

The first line, starting with `# yaml-language-server`, is required only if your IDE supports it. See Step 3 earlier for details.

:::

:::aws

```yaml
# yaml-language-server: $schema=bundle_config_schema.json
bundle:
  name: baby-names

resources:
  jobs:
    retrieve-filter-baby-names-job:
      name: retrieve-filter-baby-names-job
      job_clusters:
        - job_cluster_key: common-cluster
          new_cluster:
            spark_version: 12.2.x-scala2.12
            node_type_id: i3.xlarge
            num_workers: 1
      tasks:
        - task_key: retrieve-baby-names-task
          job_cluster_key: common-cluster
          notebook_task:
            notebook_path: ./retrieve-baby-names.py
        - task_key: filter-baby-names-task
          depends_on:
            - task_key: retrieve-baby-names-task
          job_cluster_key: common-cluster
          notebook_task:
            notebook_path: ./filter-baby-names.py

targets:
  development:
    workspace:
      host: <workspace-url>
```

:::

:::azure

```yaml
# yaml-language-server: $schema=bundle_config_schema.json
bundle:
  name: baby-names

resources:
  jobs:
    retrieve-filter-baby-names-job:
      name: retrieve-filter-baby-names-job
      job_clusters:
        - job_cluster_key: common-cluster
          new_cluster:
            spark_version: 12.2.x-scala2.12
            node_type_id: Standard_DS3_v2
            num_workers: 1
      tasks:
        - task_key: retrieve-baby-names-task
          job_cluster_key: common-cluster
          notebook_task:
            notebook_path: ./retrieve-baby-names.py
        - task_key: filter-baby-names-task
          depends_on:
            - task_key: retrieve-baby-names-task
          job_cluster_key: common-cluster
          notebook_task:
            notebook_path: ./filter-baby-names.py

targets:
  development:
    workspace:
      host: <workspace-url>
```

:::

:::gcp

```yaml
# yaml-language-server: $schema=bundle_config_schema.json
bundle:
  name: baby-names

resources:
  jobs:
    retrieve-filter-baby-names-job:
      name: retrieve-filter-baby-names-job
      job_clusters:
        - job_cluster_key: common-cluster
          new_cluster:
            spark_version: 12.2.x-scala2.12
            node_type_id: n2-highmem-4
            num_workers: 1
      tasks:
        - task_key: retrieve-baby-names-task
          job_cluster_key: common-cluster
          notebook_task:
            notebook_path: ./retrieve-baby-names.py
        - task_key: filter-baby-names-task
          depends_on:
            - task_key: retrieve-baby-names-task
          job_cluster_key: common-cluster
          notebook_task:
            notebook_path: ./filter-baby-names.py

targets:
  development:
    workspace:
      host: <workspace-url>
```

:::

For customizing jobs, the mappings in a job declaration correspond to the request payload, expressed in YAML format, of the create job operation as documented in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference.

:::tip

You can define, combine, and override the settings for new job clusters in bundles by using the techniques described in [\_](/dev-tools/bundles/cluster-override.md).

:::

## Step 5: Validate the project's bundle configuration file

In this step, you check whether the bundle configuration is valid.

1. Use the Databricks CLI to run the `bundle validate` command, as follows:

   ```bash
   databricks bundle validate
   ```

1. If a summary of the bundle configuration is returned, then the validation succeeded. If any errors are returned, fix the errors, and then repeat this step.

If you make any changes to your bundle after this step, you should repeat this step to check whether your bundle configuration is still valid.

## Step 6: Deploy the local project to the remote workspace

In this step, you deploy the two local notebooks to your remote :re[Databricks] workspace and create the :re[Databricks] job in your workspace.

1. Use the Databricks CLI to run the `bundle deploy` command as follows:

   ```bash
   databricks bundle deploy -t development
   ```

1. Check whether the two local notebooks were deployed: In your :re[Databricks] workspace's sidebar, click **Workspace**.
1. Click into the **Users \> `<your-username>` \> .bundle \> baby-names \> development \> files** folder. The two notebooks should be in this folder.
1. Check whether the job was created: In your :re[Databricks] workspace's sidebar, click **Jobs & Pipelines**.
1. Optionally, select the **Jobs** and **Owned by me** filters.
1. Click **retrieve-filter-baby-names-job**.
1. Click the **Tasks** tab. There should be two tasks: **retrieve-baby-names-task** and **filter-baby-names-task**.

If you make any changes to your bundle after this step, you should repeat steps 6-7 to check whether your bundle configuration is still valid and then redeploy the project.

## Step 7: Run the deployed project

In this step, you run the :re[Databricks] job in your workspace.

1. Use the Databricks CLI to run the `bundle run` command, as follows:

   ```bash
   databricks bundle run -t development retrieve-filter-baby-names-job
   ```

1. Copy the value of `Run URL` that appears in your terminal and paste this value into your web browser to open your :re[Databricks] workspace.
1. In your :re[Databricks] workspace, after the two tasks complete successfully and show green title bars, click the **filter-baby-names-task** task to see the query results.

If you make any changes to your bundle after this step, you should repeat steps 6-8 to check whether your bundle configuration is still valid, redeploy the project, and run the redeployed project.

## Step 8: Clean up

In this step, you delete the two deployed notebooks and the job from your workspace.

1. Use the Databricks CLI to run the `bundle destroy` command, as follows:

   ```bash
   databricks bundle destroy
   ```

1. Confirm the job deletion request: When prompted to permanently destroy resources, type `y` and press `Enter`.
1. Confirm the notebooks deletion request: When prompted to permanently destroy the previously deployed folder and all of its files, type `y` and press `Enter`.

Running the `bundle destroy` command deletes only the deployed job and the folder containing the two deployed notebooks. This command does not delete any side effects, such as the `babynames.csv` file that the first notebook created. To delete the `babybnames.csv` file, do the following:

1. In the sidebar of your :re[Databricks] workspace, click **Catalog**.
1. Click **Browse DBFS**.
1. Click the **FileStore** folder.
1. Click the dropdown arrow next to **babynames.csv**, and click **Delete**.
1. If you also want to delete the bundle from your development machine, you can now delete the local directory from Step 1.

:::aws

::replace[get-workspace-url]{value='[workspace URL](/workspace/workspace-details.md#workspace-url), for example `https://dbc-a1b2345c-d6e7.cloud.databricks.com`'}

:::

:::azure

::replace[get-workspace-url]{value='[per-workspace URL](/workspace/workspace-details.md#per-workspace-url), for example `https://adb-1234567890123456.7.azuredatabricks.net`'}

:::

:::gcp

::replace[get-workspace-url]{value='[workspace URL](/workspace/workspace-details.md#workspace-url), for example `https://1234567890123456.7.gcp.databricks.com`'}

:::
