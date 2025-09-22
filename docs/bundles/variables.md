---
description: 'Learn about substitutions and how to define custom variables in :re[DABS]'
last_update:
  date: 2025-06-23
---

# Substitutions and variables in :re[DABS]

:re[DABS] supports substitutions and custom variables, which make your bundle configuration files more modular and reusable. Both substitutions and custom variables enable dynamic retrieval of values so that settings can be determined at the time a bundle is deployed and run.

:::tip

You can also use dynamic value references for job parameter values to pass context about a job run to job tasks. See [\_](/jobs/dynamic-value-references.md) and [\_](/jobs/parameters.md).

:::

## <a id="substitutions"></a>Substitutions

You can use substitutions to retrieve values of settings that may change based on the context of the bundle deployment and run. For example, subsitutions can be used to refer to the values of the bundle `name`, bundle `target`, and workspace `userName` fields to construct the workspace `root_path` in the bundle configuration file:

```yaml
bundle:
  name: hello-bundle

workspace:
  root_path: /Workspace/Users/${workspace.current_user.userName}/.bundle/${bundle.name}/my-envs/${bundle.target}

targets:
  dev:
    default: true
```

If `someone@example.com` deployed this bundle, it would be deployed to the root path `/Workspace/Users/someone@example.com/.bundle/hello-bundle/my-envs/dev`.

You can also create substitutions for named resources. For example, for the following pipeline definition, you can use `${resources.pipelines.my_pipeline.target}` for the value of the pipeline's target:

```yaml
resources:
  pipelines:
    my_pipeline:
      name: my_pipeline
      schema: pipeline_bundle_${bundle.target}
      libraries:
        - notebook:
            path: ../src/dlt_pipeline.ipynb

      configuration:
        bundle.sourcePath: ${workspace.file_path}/src
```

To determine valid substitutions, use the [bundle configuration reference](/dev-tools/bundles/reference.md), the [resource configuration reference](/dev-tools/bundles/resources.md) or the schema hierarchy of corresponding objects documented in the [REST API reference](https://docs.databricks.com/api/workspace/introduction), or the output of the `bundle schema` command.

Here are some commonly used substitutions:

- `${bundle.name}`
- `${bundle.target}  # Use this substitution instead of ${bundle.environment}`
- `${workspace.host}`
- `${workspace.current_user.short_name}`
- `${workspace.current_user.userName}`
- `${workspace.file_path}`
- `${workspace.root_path}`
- `${resources.jobs.<job-name>.id}`
- `${resources.models.<model-name>.name}`
- `${resources.pipelines.<pipeline-name>.name}`

## <a id="custom-variables"></a>Custom variables

You can define both simple and complex custom variables in your bundle to enable dynamic retrieval of values needed for many scenarios. Custom variables are declared in your bundle configuration files within the `variables` mapping or in a `variable-overrides.json` file. For information about the `variables` mapping, see [\_](/dev-tools/bundles/settings.md#variables-mappings).

The following example configuration defines the variables `my_cluster_id` and `my_notebook_path`:

```yaml
variables:
  my_cluster_id:
    description: The ID of an existing cluster.
    default: 1234-567890-abcde123
  my_notebook_path:
    description: The path to an existing notebook.
    default: ./hello.py
```

If you do not provide a `default` value for a variable as part of this declaration, you must set it when executing bundle commands, through an environment variable, elsewhere within your bundle configuration files, or in the `.databricks/bundle/<target>/variable-overrides.json` file in the bundle project. See [\_](#set-variable-value).

### Reference a variable

To reference a custom variable within your bundle configuration, use the variable [substitution](#substitutions) `${var.<variable_name>}`. For example, the following configuration references the variables `my_cluster_id` and `my_notebook_path`:

```yaml
resources:
  jobs:
    hello-job:
      name: hello-job
      tasks:
        - task_key: hello-task
          existing_cluster_id: ${var.my_cluster_id}
          notebook_task:
            notebook_path: ${var.my_notebook_path}
```

### <a id="set-variable-value"></a>Set a variable's value

If you have not provided a `default` value for a variable, or if you want to temporarily override the `default` value for a variable, provide the variable's new temporary value using one of the following approaches:

- Provide the variable's value as part of a `bundle` command such as `validate`, `deploy`, or `run`. To do this, use the option `--var="<key>=<value>"`, where `<key>` is the variable's name, and `<value>` is the variable's value. For example, as part of the `bundle validate` command, to provide the value of `1234-567890-abcde123` to the variable named `my_cluster_id`, and to provide the value of `./hello.py` to the variable named `my_notebook_path`, run:

  ```bash
  databricks bundle validate --var="my_cluster_id=1234-567890-abcde123,my_notebook_path=./hello.py"

  # Or:
  databricks bundle validate --var="my_cluster_id=1234-567890-abcde123" --var="my_notebook_path=./hello.py"
  ```

- Provide the variable's value by setting an environment variable. The environment variable's name must start with `BUNDLE_VAR_`. To set environment variables, see your operating system's documentation. For example, to provide the value of `1234-567890-abcde123` to the variable named `my_cluster_id`, and to provide the value of `./hello.py` to the variable named `my_notebook_path`, run the following command before you call a `bundle` command such as `validate`, `deploy`, or `run`:

  For Linux and macOS:

  ```bash
  export BUNDLE_VAR_my_cluster_id=1234-567890-abcde123 && export BUNDLE_VAR_my_notebook_path=./hello.py
  ```

  For Windows:

  ```bash
  "set BUNDLE_VAR_my_cluster_id=1234-567890-abcde123" && "set BUNDLE_VAR_my_notebook_path=./hello.py"
  ```

  Or, provide the variable's value as part of a `bundle` command such as `validate`, `deploy`, or `run`, for example for Linux and macOS:

  ```bash
  BUNDLE_VAR_my_cluster_id=1234-567890-abcde123 BUNDLE_VAR_my_notebook_path=./hello.py databricks bundle validate
  ```

  Or for Windows:

  ```bash
  "set BUNDLE_VAR_my_cluster_id=1234-567890-abcde123" && "set BUNDLE_VAR_my_notebook_path=./hello.py" && "databricks bundle validate"
  ```

- Provide the variable's value within your bundle configuration files using the `variables` mapping within the `targets` mapping, following this format:

  ```yaml
  variables:
    <variable-name>: <value>
  ```

  For example, to set values for the variables named `my_cluster_id` and `my_notebook_path` for two separate targets:

  ```yaml
  targets:
    dev:
      variables:
        my_cluster_id: 1234-567890-abcde123
        my_notebook_path: ./hello.py
    prod:
      variables:
        my_cluster_id: 2345-678901-bcdef234
        my_notebook_path: ./hello.py
  ```

- Provide the variable's value within the `.databricks/bundle/<target>/variable-overrides.json` file, using the following format:

  ```json
  {
    "<variable-name>": "<variable-value>"
  }
  ```

  For example, to provide values for the variables named `my_cluster_id` and `my_notebook_path` for the dev target, create a file `.databricks/bundle/dev/variable-overrides.json` and set its contents to:

  ```json
  {
    "my_cluster_id": "1234-567890-abcde123",
    "my_notebook_path": "./hello.py"
  }
  ```

  You can also define complex variables in the `variable-overrides.json` file.

:::note

Whichever approach you choose to provide variable values, use the same approach during both the deployment and run stages. Otherwise, you might get unexpected results between the time of a deployment and a job or pipeline run that is based on that existing deployment.

:::

#### Precedence order

The Databricks CLI looks for values for variables in the following order, stopping when it finds a value for a variable:

1. Within any `--var` options specified as part of the `bundle` command.
1. Within any environment variables set that begin with `BUNDLE_VAR_`.
1. Within the `variables-overrides.json` file, if it exists.
1. Within any `variables` mappings, among the `targets` mappings within your bundle configuration files.
1. Any `default` value for that variable's definition, among the top-level `variables` mappings within your bundle configuration files.

### <a id="complex-variables"></a>Define a complex variable

A custom variable is assumed to be of type string unless you define it as a complex variable. To define a custom variable with a complex type for your bundle in your bundle configuration, set `type` to `complex`.

:::note

The only valid value for the `type` setting is `complex`. In addition, bundle validation fails if `type` is set to `complex` and the `default` defined for the variable is a single value.

:::

In the following example, cluster settings are defined within a custom complex variable named `my_cluster`:

```yaml
variables:
  my_cluster:
    description: 'My cluster definition'
    type: complex
    default:
      spark_version: '13.2.x-scala2.11'
      node_type_id: 'Standard_DS3_v2'
      num_workers: 2
      spark_conf:
        spark.speculation: true
        spark.databricks.delta.retentionDurationCheck.enabled: false

resources:
  jobs:
    my_job:
      job_clusters:
        - job_cluster_key: my_cluster_key
          new_cluster: ${var.my_cluster}
      tasks:
        - task_key: hello_task
          job_cluster_key: my_cluster_key
```

You can also define a complex variable in the `.databricks/bundle/<target>/variable-overrides.json` file, as shown in the following example:

```json
{
  "my_cluster": {
    "spark_version": "13.2.x-scala2.11",
    "node_type_id": "Standard_DS3_v2",
    "num_workers": 2
  }
}
```

### <a id="lookup"></a>Retrieve an object's ID value

For the `alert`, `cluster_policy`, `cluster`, `dashboard`, `instance_pool`, `job`, `metastore`, `notification_destination`, `pipeline`, `query`, `service_principal`, and `warehouse` object types, you can define a `lookup` for your custom variable to retrieve a named object's ID using this format:

```yaml
variables:
  <variable-name>:
    lookup:
      <object-type>: '<object-name>'
```

If a lookup is defined for a variable, the ID of the object with the specified name is used as the value of the variable. This ensures the correct resolved ID of the object is always used for the variable.

:::note

An error occurs if an object with the specified name does not exist, or if there is more than one object with the specified name.

:::

For example, in the following configuration, `${var.my_cluster_id}` will be replaced by the ID of the _12.2 shared_ cluster.

```yaml
variables:
  my_cluster_id:
    description: An existing cluster
    lookup:
      cluster: '12.2 shared'

resources:
  jobs:
    my_job:
      name: 'My Job'
      tasks:
        - task_key: TestTask
          existing_cluster_id: ${var.my_cluster_id}
```

## Output substitution and variable values

To ensure your substitutions and variables are correctly specified and parsed by :re[DABS], run `databricks bundle validate`. See [\_](/dev-tools/cli/bundle-commands.md#validate). To view values that will be used when you deploy a bundle, use the `--output json` option:

```bash
databricks bundle validate --output json
```

For example, for a bundle with the variable `my_cluster_id` defined and used in a job task:

```yaml
bundle:
  name: variables_bundle

variables:
  my_cluster_id:
    default: 1234-567890-abcde123

resources:
  jobs:
    variables_bundle_job:
      name: variables_bundle_job
      tasks:
        - task_key: notebook_task
          existing_cluster_id: ${var.my_cluster_id}
          notebook_task:
            notebook_path: ../src/notebook.ipynb
```

The `databricks bundle validate` schema output would be the following:

```json
{
  "bundle": {
    "..."
    "name": "variables_bundle",
    "target": "dev",
  "..."
  },
  "resources": {
    "jobs": {
      "variables_bundle_job": {
        "deployment": {
          "kind": "BUNDLE",
          "metadata_file_path": "/Workspace/Users/someone@example.com/.bundle/variables_bundle/dev/state/metadata.json"
        },
        "max_concurrent_runs": 4,
        "name": "[dev someone] variables_bundle_job",
        "tasks": [
          {
            "existing_cluster_id": "1234-567890-abcde123",
            "notebook_task": {
              "notebook_path": "/Workspace/Users/someone@example.com/.bundle/variables_bundle/dev/files/variables_bundle/src/notebook"
            },
            "task_key": "notebook_task"
          },
        ],
      "..."
      }
    }
  },
  "..."
  "variables": {
    "my_cluster_id": {
      "default": "1234-567890-abcde123",
      "value": "1234-567890-abcde123"
    }
  },
"..."
}
```
