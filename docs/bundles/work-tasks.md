---
description: 'Learn about the steps for creating and managing :re[DABS]. Bundles enable programmatic management of Databricks workflows.'
last_update:
  date: 2025-06-23
---

# Develop :re[DABS]

This article describes the development and lifecycle of a _Databricks Asset Bundle_. For general information about :re[DABS], see [\_](/dev-tools/bundles/index.md).

## <a id="lifecycle"></a>Lifecycle of a bundle

To understand how to effectively use bundles, you need to understand the basic lifecycle of a bundle:

1. The bundle skeleton is [created](#create) based on a project.
1. The bundle project is [developed](#develop) locally. A bundle contains configuration files that define infrastructure and workspace settings such as deployment targets, settings for Databricks resources such as jobs and pipelines, as well as source files and other artifacts.
1. The bundle project is [validated](#validate). Validation verifies the settings and resource definitions in the bundle configuration against the corresponding object schemas to ensure the bundle is deployable to Databricks.
1. The bundle is [deployed](#deploy) to a target workspace. Most commonly a bundle is first deployed to a user's personal dev workspace for testing. Once testing of the bundle is finished, the bundle can be deployed to staging, then production targets.
1. Workflow resources defined in the deployed bundle can be [run](#run). For example, you can run a job.
1. If the bundle is no longer being used, it can be permanently [destroyed](#destroy).

You use the [Databricks CLI bundle commands](/dev-tools/cli/bundle-commands.md) to create, validate, deploy, run, and destroy bundles, as described in the following sections.

## <a id="create"></a>Step 1: Create a bundle

There are three ways to begin creating a bundle:

1. Use the default bundle template.
1. Use a custom bundle template.
1. Create a bundle manually.

### Use a default bundle template

To use a :re[Databricks] default bundle template to create a starter bundle that you can then customize further, use [Databricks CLI](/dev-tools/cli/index.md) version 0.218.0 or above to run the `bundle init` command, which allows you to choose from a list of available templates. See [\_](/dev-tools/cli/bundle-commands.md#init).

```bash
databricks bundle init
```

You can view the source for the default bundle templates in the [databricks/cli](https://github.com/databricks/cli/tree/main/libs/template/templates) and [databricks/mlops-stacks](https://github.com/databricks/mlops-stacks) Github public repositories.

Skip ahead to [\_](#step-2-populate-the-bundle-configuration-files).

### Use a custom bundle template

To use a bundle template other than the :re[Databricks] default bundle template, you must know the local path or the URL to the remote bundle template location. Use [Databricks CLI](/dev-tools/cli/index.md) version 0.218.0 or above to run the `bundle init` command as follows:

```bash
databricks bundle init <project-template-local-path-or-url>
```

For more information about this command, see [\_](/dev-tools/bundles/templates.md). For information about a specific bundle template, see the bundle template provider's documentation.

Skip ahead to [\_](#step-2-populate-the-bundle-configuration-files).

### Create a bundle manually

To create a bundle manually instead of by using a bundle template, create a project directory on your local machine, or an empty repository with a third-party Git provider.

In your directory or repository, create one or more bundle configuration files as input. These files are expressed in YAML format. There must be at minimum one (and only one) bundle configuration file named `databricks.yml`. Additional bundle configuration files must be referenced in the `include` mapping of the `databricks.yml` file.

To more easily and quickly create YAML files that conform to the Databricks Asset Bundle configuration syntax, you can use a tool such as [Visual Studio Code](https://code.visualstudio.com), [PyCharm Professional](https://www.jetbrains.com/pycharm/), or [IntelliJ IDEA Ultimate](https://www.jetbrains.com/idea/) that provide support for YAML files and JSON schema files, as follows:

:::::tabs

::::tab-item[Visual&nbsp;Studio&nbsp;Code]

1. Add YAML language server support to :re[VSC], for example by installing the [YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) extension from the Visual Studio Code Marketplace.
1. Generate the Databricks Asset Bundle configuration JSON schema file using [Databricks CLI](/dev-tools/cli/index.md) version 0.218.0 or above to run the `bundle schema` [command](/dev-tools/cli/bundle-commands.md#schema) and redirect the output to a JSON file. For example, generate a file named `bundle_config_schema.json` within the current directory, as follows:

   ```bash
   databricks bundle schema > bundle_config_schema.json
   ```

1. Use :re[VSC] to create or open a bundle configuration file within the current directory. This file must be named `databricks.yml`.
1. Add the following comment to the beginning of your bundle configuration file:

   ```yaml
   # yaml-language-server: $schema=bundle_config_schema.json
   ```

   :::note

   In the preceding comment, if your Databricks Asset Bundle configuration JSON schema file is in a different path, replace `bundle_config_schema.json` with the full path to your schema file.

   :::

1. Use the YAML language server features that you added earlier. For more information, see your YAML language server's documentation.

::::

:::tab-item[PyCharm&nbsp;Professional]

1. Generate the Databricks Asset Bundle configuration JSON schema file by using [Databricks CLI](/dev-tools/cli/index.md) version 0.218.0 or above to run the `bundle schema` [command](/dev-tools/cli/bundle-commands.md#schema) and redirect the output to a JSON file. For example, generate a file named `bundle_config_schema.json` within the current directory, as follows:

   ```bash
   databricks bundle schema > bundle_config_schema.json
   ```

1. Configure PyCharm to recognize the bundle configuration JSON schema file, and then complete the JSON schema mapping, by following the instructions in [Configure a custom JSON schema](https://www.jetbrains.com/help/pycharm/json.html#ws_json_schema_add_custom_procedure).
1. Use PyCharm to create or open a bundle configuration file. This file must be named `databricks.yml`. As you type, PyCharm checks for JSON schema syntax and formatting and provides code completion hints.

:::

:::tab-item[IntelliJ&nbsp;IDEA&nbsp;Ultimate]

1. Generate the Databricks Asset Bundle configuration JSON schema file by using [Databricks CLI](/dev-tools/cli/index.md) version 0.218.0 or above to run the `bundle schema` [command](/dev-tools/cli/bundle-commands.md#schema) and redirect the output to a JSON file. For example, generate a file named `bundle_config_schema.json` within the current directory, as follows:

   ```bash
   databricks bundle schema > bundle_config_schema.json
   ```

1. Configure IntelliJ IDEA to recognize the bundle configuration JSON schema file, and then complete the JSON schema mapping, by following the instructions in [Configure a custom JSON schema](https://www.jetbrains.com/help/idea/json.html#ws_json_schema_add_custom_procedure).
1. Use IntelliJ IDEA to create or open a bundle configuration file. This file must be named `databricks.yml`. As you type, IntelliJ IDEA checks for JSON schema syntax and formatting and provides code completion hints.

:::

:::::

## <a id="develop"></a>Step 2: Populate the bundle configuration files

Bundle configuration files define your :re[Databricks] workflows by specifying settings such as workspace details, artifact names, file locations, job details, and pipeline details. Typically bundle configuration also contains development, staging, and production deployment targets. For detailed information about bundle configuration files, see [\_](/dev-tools/bundles/settings.md).

You can use the `bundle generate` command to autogenerate bundle configuration for an existing resource in the workspace, then use `bundle deployment bind` to link the bundle configuration to the resource in the workspace to keep them in sync. See [\_](/dev-tools/cli/bundle-commands.md#generate) and [\_](/dev-tools/cli/bundle-commands.md#bind).

## <a id="validate"></a>Step 3: Validate the bundle configuration files

Before you deploy artifacts or run a job or pipeline, you should verify that definitions in your bundle configuration files are valid. To do this, run the `bundle validate` command from the bundle project root directory. See [\_](/dev-tools/cli/bundle-commands.md#validate).

```bash
databricks bundle validate
```

If the validation is successful, a summary of the bundle identity and a confirmation message is returned. To output the schema, use the `databricks bundle schema` command. See [\_](/dev-tools/cli/bundle-commands.md#schema).

## <a id="deploy"></a>Step 4: Deploy the bundle

Before you deploy the bundle, make sure that the remote workspace has workspace files enabled. See [\_](/files/workspace.md).

To deploy a bundle to a remote workspace, run the `bundle deploy` command from the bundle root as described in [\_](/dev-tools/cli/bundle-commands.md#deploy). The Databricks CLI deploys to the target workspace that is declared within the bundle configuration files. See [\_](/dev-tools/bundles/settings.md#bundle-syntax-mappings-targets).

```bash
databricks bundle deploy
```

A bundle's unique identity is defined by its name, target, and the identity of the deployer. If these attributes are identical across different bundles, deployment of these bundles will interfere with one another. See [\_](/dev-tools/cli/bundle-commands.md#deploy) for additional details.

:::tip

You can run `databricks bundle` commands outside of the bundle root by setting the `BUNDLE_ROOT` environment variable. If this environment variable is not set, `databricks bundle` commands attempt to find the bundle root by searching within the current working directory.

:::

## <a id="run"></a>Step 5: Run the bundle

To run a specific job or pipeline, run the `bundle run` command from the bundle root, specifying the job or pipeline key declared within the bundle configuration files, as described in [\_](/dev-tools/cli/bundle-commands.md#run). The resource key is the top-level element of the resource's YAML block. If you do not specify a job or pipeline key, you are prompted to select a resource to run from a list of available resources. If the `-t` option is not specified, the default target as declared within the bundle configuration files is used. For example, to run a job with the key `hello_job` within the context of the default target:

```bash
databricks bundle run hello_job
```

To run a job with a key `hello_job` within the context of a target declared with the name `dev`:

```bash
databricks bundle run -t dev hello_job
```

## <a id="destroy"></a>Step 6: Destroy the bundle

:::warning

Destroying a bundle permanently deletes a bundle's previously-deployed jobs, pipelines, and artifacts. This action cannot be undone.

:::

If you are finished with your bundle and want to delete jobs, pipelines, and artifacts that were previously deployed, run the `bundle destroy` command from the bundle root. This command deletes all previously-deployed jobs, pipelines, and artifacts that are defined in the bundle configuration files. See [\_](/dev-tools/cli/bundle-commands.md#destroy).

```bash
databricks bundle destroy
```

By default, you are prompted to confirm permanent deletion of the previously-deployed jobs, pipelines, and artifacts. To skip these prompts and perform automatic permanent deletion, add the `--auto-approve` option to the `bundle destroy` command.
