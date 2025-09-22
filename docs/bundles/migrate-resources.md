---
description: 'Learn how to generate bundle resource configuration for an existing resource, such as a job or pipeline, add it to a bundle and bind to the existing resource in the workspace.'
last_update:
  date: 2025-08-25
---

# Migrate existing resources to a bundle

When building your bundle, you may want to include Databricks resources that already exist and are fully configured in the remote workspace. You can use the Databricks CLI `bundle generate` command to quickly autogenerate configuration in your bundle for existing apps, dashboards, jobs, and pipelines. See [\_](/dev-tools/cli/bundle-commands.md#generate). Configuration that you can copy and manually paste into bundle resource configuration files is available in the Databricks UI for some resources, such as jobs and pipelines.

After you have generated configuration for a resource in your bundle and deployed the bundle, use the `bundle deployment bind` command to bind a resource in your bundle to the corresponding resource in the workspace. See [\_](/dev-tools/cli/bundle-commands.md#bind).

This page provides simple examples that use the Databricks CLI or UI to generate or retrieve bundle resource configuration.

For details about resource definitions in bundles, see [\_](/dev-tools/bundles/resources.md).

## Generate an existing job or pipeline configuration using the Databricks CLI

To programmatically generate bundle configuration for an existing job or pipeline:

1. Retrieve the ID of the existing job or pipeline from the **Job details** or **Pipeline details** side panel for the job or pipeline in the UI. Alternatively, use the Databricks CLI `databricks jobs list` or `databricks pipelines list-pipelines` command.
1. Run the `bundle generate job` or `bundle generate pipeline` [Databricks CLI command](/dev-tools/cli/bundle-commands.md#generate), setting the job or pipeline ID:

   ```bash
   databricks bundle generate job --existing-job-id 6565621249
   ```

   ```bash
   databricks bundle generate pipeline --existing-pipeline-id 6565621249
   ```

   This command creates a bundle configuration file for the resource in the bundle's `resources` folder and downloads any referenced artifacts to the `src` folder.

You can also generate configuration for an existing dashboard. See [\_](/dev-tools/cli/bundle-commands.md#generate-dashboard).

## <a id="existing-job"></a>Retrieve an existing job definition using the UI

To retrieve the YAML representation of an existing job definition from the :re[Databricks] workspace UI:

1. In your :re[Databricks] workspace's sidebar, click **Jobs & Pipelines**.
1. Optionally, select the **Jobs** and **Owned by me** filters.
1. Click your job's **Name** link.
1. Next to the **Run now** button, click the kebab, and then click **Edit as YAML**.
1. Copy the YAML and add it to your bundle's `databricks.yml` file, or create a configuration file for your job in the `resources` directory of your bundle project and reference it from your `databricks.yml` file. See [\_](/dev-tools/bundles/settings.md#resources).
1. Download and add any Python files and notebooks that are referenced in the existing job to the bundle's project source. Typically bundle artifacts are located in the `src` directory in a bundle.

   :::tip

   You can export an existing notebook from a :re[Databricks] workspace into the `.ipynb` format by clicking **File \> Export \> IPython Notebook** from the :re[Databricks] notebook user interface.

   :::

   After you add your notebooks, Python files, and other artifacts to the bundle, change the references to these files in your job definition to their local location. For example, if you had a `hello_job.job.yml` configuration file in the `resources` folder of your bundle, and you downloaded a notebook named `hello.ipynb` to the `src` folder of your bundle, the contents of the `hello_job.job.yml` file would be the following:

   ```yaml
   resources:
     jobs:
       hello_job:
         name: hello_job
         tasks:
           - task_key: hello_task
             notebook_task:
               notebook_path: ../src/hello.ipynb
   ```

For more information about viewing jobs as code in the UI, see [\_](/jobs/automate.md#view-code).

## <a id="existing-pipeline"></a>Retrieve an existing pipeline definition using the UI

::::aws

:::tip

For a tutorial that shows how to convert existing :re[LDP] into a :re[DABS] project, see [\_](/dlt/convert-to-dab.md).

:::

::::

To retrieve the YAML representation of an existing pipeline definition from the :re[Databricks] workspace UI:

1. In your :re[Databricks] workspace's sidebar, click **Jobs & Pipelines**.
1. Optionally, select the **Pipelines** filter.
1. Click the **Name** of your pipeline.
1. Next to the **Development** button, click the :re[Kebab menu], and then click **View settings YAML**.
1. Copy the pipeline definition's YAML in the **Pipeline settings YAML** dialog to your local clipboard by clicking the copy icon.
1. Add the YAML that you copied to your bundle's `databricks.yml` file, or create a configuration file for your pipeline in the `resources` folder of your bundle project and reference it from your `databricks.yml` file. See [\_](/dev-tools/bundles/settings.md#resources).
1. Download and add any Python files and notebooks that are referenced to the bundle's project source. Typically bundle artifacts are located in the `src` directory in a bundle.

   :::tip

   You can export an existing notebook from a :re[Databricks] workspace into the `.ipynb` format by clicking **File \> Export \> IPython Notebook** from the :re[Databricks] notebook user interface.

   :::

   After you add your notebooks, Python files, and other artifacts to the bundle, make sure that your pipeline definition properly references them. For example, for a notebook named `hello.ipynb` that is in the `src/` directory of the bundle:

   ```yaml
   resources:
     pipelines:
       hello_pipeline:
         name: hello_pipeline
         libraries:
           - notebook:
               path: ../src/hello.ipynb
   ```

## Bind a resource to its remote counterpart

Typically after you have added a resource to your bundle, you will want to ensure the resource in your bundle and the existing resource in the workspace stay in sync. The `bundle deployment bind` command allows you to link them. If you bind a resource, the linked :re[Databricks] resource in the workspace is updated based on the configuration defined in the bundle on the next `bundle deploy`.

For more information about `bundle deployment bind` and details about resource support, see [\_](/dev-tools/cli/bundle-commands.md#bind).

The following command binds the resource `hello_job` to its remote counterpart in the workspace. It prompts with a confirmation to ensure that updates to the job configuration in the bundle should be applied to the corresponding remote job when the bundle is next deployed.

```bash
databricks bundle deployment bind hello_job 6565621249
```

To remove the link between a bundle resource and its counterpart in the workspace, use `bundle deployment unbind`. See [\_](/dev-tools/cli/bundle-commands.md#unbind).

```bash
databricks bundle deployment unbind hello_job
```

## Migrate a resource that exists in two workspaces

In some setups, the same resource may exist in more than one workspace. For example, the same job might be in a development and a production workspace. If the existing job is added to the bundle and then the bundle is deployed to one of these workspaces, duplicate jobs are created. To prevent this, use `databricks bundle generate` and `databricks bundle deployment bind` together:

1. Define the dev and prod targets in your bundle `databricks.yml`.
1. Generate bundle configuration for the resource (in this example, a job) in the dev target:

   ```bash
   databricks bundle generate job --existing-job-id <dev_job_id> –-target dev
   ```

1. The configuration of the resource in prod will likely be different than the configuration of the resource in dev, so now that you have generated configuration for the resource, define the production-specific settings for the resource (in the prod target) in the bundle.

   ```yaml
   targets:
     dev:
       default: true
       #...
     prod:
       #...
       resources:
         jobs:
           my_job:
             # Job prod settings
   ```

1. Bind the resource in the bundle to the existing job in the dev and prod targets:

   ```bash
   databricks bundle deployment bind my_job <dev_job_id> --target dev
   ```

   ```bash
   databricks bundle deployment bind my_job <prod_job_id> --target prod
   ```

The bundle can now be deployed to the two environments:

```bash
databricks bundle deploy --target dev
```

```bash
databricks bundle deploy --target prod
```
