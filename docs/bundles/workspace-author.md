---
description: 'Learn how to author :re[DABS] in the workspace.'
last_update:
  date: 2025-08-14
---

# Author bundles in the workspace

:::info[Preview]

:re[DABS] in the workspace is in [Public Preview](/release-notes/release-types.md).

:::

:re[DABS] can be created and modified directly in the workspace.

For requirements for using bundles in the workspace, see [Databricks Asset Bundles in the workspace requirements](/dev-tools/bundles/workspace.md#requirements).

For more information about bundles, see [\_](/dev-tools/bundles/index.md).

## Create a bundle

To create a bundle in the Databricks workspace:

1. Navigate to the Git folder where you want to create your bundle.
1. Click the **Create** button, then click **Asset bundle**. Alternatively, right click on the Git folder or its associated kebab in the workspace tree and click **Create** \> **Asset bundle**:

   ![Create an asset bundle](/images/bundles/create.png)

1. In the **Create an asset bundle** dialog, give the asset bundle a name, such as _totally-awesome-bundle_. The bundle name can only contain letters, numbers, dashes, and underscores.

1. For **Template**, choose whether you want to create an empty bundle, a bundle that runs a sample Python notebook, or a bundle that runs SQL. If you have the [Lakeflow Pipelines Editor](/dlt/dlt-multi-file-editor.md) enabled, you will also see an option to create an ETL pipeline project.

1. Some templates require additional configuration. Click **Next** to finish configuring the project.

   :::list-table

   - - Template
     - Configuration options
   - - :re[LDP]
     - - Initial catalog - the catalog to use for the pipeline data
       - Use personal schema - whether to use a personal schema for each user collaborating on this bundle
       - Initial schema during development - the schema to use
       - Initial language for this project - the language for the code files in the pipeline
   - - Default Python
     - - Include a sample notebook
       - Include a sample pipeline
       - Include a sample Python package
       - Use serverless compute
   - - Default SQL
     - - SQL warehouse path
       - Initial catalog
       - Use personal schema
       - Initial schema during development

   :::

1. Click **Create and deploy**.

   ![Create new asset bundle dialog](/images/bundles/create-dialog.png)

This creates an initial bundle in the Git folder, which includes the files for the project template that you selected, a `.gitignore` Git configuration file, and the required :re[DABS] `databricks.yml` file. The `databricks.yml` file contains the main configuration for the bundle. For details, see [\_](/dev-tools/bundles/settings.md).

![New asset bundle](/images/bundles/new.png)

Any changes made to the files within the bundle can be synced with the remote repository associated with the Git folder. A Git folder can contain many bundles.

## Add new files to a bundle

A bundle contains the `databricks.yml` file that defines deployment and workspace configurations, source files, such as notebooks, Python files, and test files, and definitions and settings for Databricks resources, such as Lakeflow Jobs and :re[LDP]. Similar to any workspace folder, you can add new files to your bundle.

:::tip

To open a new tab to the bundle view that lets you modify bundle files, navigate to the bundle folder in the workspace, then click **Open in editor** to the right of the bundle name.

:::

### Add source code files

To add new notebooks or other files to a bundle in the workspace UI, navigate to the bundle folder, then:

- Click **Create** in the upper right and choose one of the following file types to add to your bundle: Notebook, File, Query, Dashboard.
- Alternatively, click the kebab to the left of **Share** and import a file.

:::note

In order for the file to be part of the bundle deployment, after you add a file to your bundle folder you must add it to the `databricks.yml` bundle configuration, or create a job or pipeline definition file that includes it. See [\_](#add-existing).

:::

### Add a job definition

Bundles contain definitions for resources such as jobs and pipelines to include in a deployment. These definitions are specified in YAML or Python, and you can create and edit these configurations directly in the UI.

To create a bundle configuration file that defines a job:

1. Navigate to the bundle folder in the workspace where you want to define a new job.
1. To the right of the bundle name, click **Open in editor** to navigate to the bundle editor view.
1. Click the deployment icon for the bundle to switch to the **Deployments** panel.

   ![Deployments panel icon](/images/bundles/deployment-icon.png)

1. Under **Bundle resources**, click **Create**, then **Create new job definition**.

   ![Create job definition](/images/bundles/job-definition.png)

1. Type a name for the job into the **Job name** field of the **Create job definition** dialog. Click **Create**.
1. Add YAML to the job definition file that was created. The folowing example YAML defines a job the runs a notebook:

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

For details about defining a job in YAML, see [\_](/dev-tools/bundles/resources.md#jobs). For YAML syntax for other supported job task types, see [\_](/dev-tools/bundles/job-task-types.md).

### Add a pipeline

To add a pipeline to your bundle:

1. Navigate to the bundle folder in the workspace where you want to define a new pipeline.
1. To the right of the bundle name, click **Open in editor** to navigate to the bundle editor view.
1. Click the deployment icon for the bundle to switch to the **Deployments** panel.

   ![Deployments panel icon](/images/bundles/deployment-icon.png)

1. Under **Bundle resources**, click **Create**, then **Create new pipeline definition** or **Create new ETL pipeline** if you have enabled the [Lakeflow Pipelines Editor](/dlt/dlt-multi-file-editor.md) in your workspace. The pipeline creation experience differs for these two options.

#### Create pipeline definition

If you selected **Create new pipeline definition** from the bundle resource creation menu, next:

1. Type a name for the pipeline into the **Pipeline name** field of the **Create pipeline definition** dialog.
1. Click the folder icon to the right of the **Source code** field and select the code for this pipeline to run. Click **Create**.

For a pipeline with the name `test_pipeline` that runs a notebook, the folowing YAML is created in a file `test_pipeline.pipeline.yml`:

```yaml
resources:
  pipelines:
    test_pipeline:
      name: test_pipeline
      libraries:
        - notebook:
            path: ../helloworld.ipynb
      serverless: true
      catalog: main
      target: test_pipeline_${bundle.environment}
```

For details about defining a pipeline in YAML, see [\_](/dev-tools/bundles/resources.md#pipelines).

#### <a id="etl"></a>Create ETL pipeline

If you selected **Create new ETL pipeline** from the bundle resource creation menu, next:

1. Type a name for the pipeline into the **Name** field of the **Create pipeline** dialog. The name must be unique within the workspace.
1. For the **Use personal schema** field, select **Yes** for development scenarios and **No** for production scenarios.
1. Select a **Default catalog** and a **Default schema** for the pipeline.
1. Choose a language for the pipeline source code.
1. Click **Create and deploy**.

![Create an ETL pipeline dialog](/images/bundles/create-pipeline.png)

An ETL pipeline is created with example exploration and transformation tables.

![ETL pipeline in a bundle in the workspace](/images/bundles/etl-pipeline.png)

For a pipeline with the name `rad_pipeline`, the following YAML is created in a file `rad_pipeline.pipeline.yml`. This pipeline is configured to run on serverless compute.

```yaml
resources:
  pipelines:
    rad_pipeline:
      name: rad_pipeline
      libraries:
        - glob:
            include: transformations/**
      serverless: true
      catalog: main
      schema: ${workspace.current_user.short_name}
      root_path: .
```

## <a id="add-existing"></a>Add an existing resource to a bundle

You can add existing resources such as pipelines, and also assets such as notebooks and other source files, to your bundle. However, you must define them in the bundle configuration to include them in your bundle deployment. The following example adds an existing pipeline to a bundle.

Assuming you have a pipeline named `taxifilter` that runs the `taxifilter.ipynb` notebook in your shared workspace:

1. In your :re[Databricks] workspace's sidebar, click **Jobs & Pipelines**.
1. Optionally, select the **Pipelines** and **Owned by me** filters.
1. Select the existing `taxifilter` pipeline.
1. In the pipeline page, click the kebab to the left of the **Development** deployment mode button. Then click **View settings YAML**.
1. Click the copy icon to copy the bundle configuration for the pipeline.
1. Navigate to your bundle in **Workspace**.
1. Click the deployment icon for the bundle to switch to the **Deployments** panel.
1. Under **Bundle resources**, click **Create**, then **Create new pipeline definition**.
1. Type `taxifilter` into the **Pipeline name** field of the **Create pipeline definition** dialog. Click **Create**.
1. Paste the configuration for the existing pipeline into the file. This example pipeline is defined to run the `taxifilter` notebook:

   ```yaml
   resources:
     pipelines:
       taxifilter:
         name: taxifilter
         catalog: main
         libraries:
           - notebook:
               path: /Workspace/Shared/taxifilter.ipynb
         target: taxifilter_${bundle.environment}
   ```

You can now deploy the bundle, then run the pipeline resource through the UI.
