---
description: 'Learn how to create a custom Databricks Asset Bundle template that runs a job with a specific Python task on a cluster using a Docker container image.'
last_update:
  date: 2025-03-05
---

# Create a custom Databricks Asset Bundle template

In this tutorial, you'll create a custom Databricks Asset Bundle template for creating bundles that run a job with a specific Python task on a cluster using a specific Docker container image.

For information about custom bundle templates, see [\_](/dev-tools/bundles/templates.md#custom-templates).

::::gcp

:::note

Custom Docker container images are not supported on :re[GCP].

:::

::::

## Requirements

- Install the [Databricks CLI](/dev-tools/cli/index.md) version 0.218.0 or above. If you've already installed it, confirm the version is 0.218.0 or higher by running `databricks -version` from the command line.

## Define user prompt variables

The first step in buidling a bundle template is to define the `databricks bundle init` user prompt variables. From the command line:

1. Create an empty directory named `dab-container-template`:

   ```sh
   mkdir dab-container-template
   ```

1. In the directory's root, create a file named `databricks_template_schema.json`:

   ```sh
   cd dab-container-template
   touch databricks_template_schema.json
   ```

1. Add the following contents to the `databricks_template_schema.json` and save the file. Each variable will be translated to a user prompt during bundle creation.

   ```json
   {
     "properties": {
       "project_name": {
         "type": "string",
         "default": "project_name",
         "description": "Project name",
         "order": 1
       }
     }
   }
   ```

## Create the bundle folder structure

Next, in the template directory, create subdirectories named `resources` and `src`. The `template` folder contains the directory structure for your generated bundles. The names of the subdirectories and files will follow Go package template syntax when derived from user values.

```sh
  mkdir -p "template/resources"
  mkdir -p "template/src"
```

## Add YAML configuration templates

In the `template` directory, create a file named `databricks.yml.tmpl` and add the following YAML. This example uses [bundle template helpers](/dev-tools/bundles/templates.md#helpers).

```sh
  touch template/databricks.yml.tmpl
```

```yaml
  # This is a Databricks asset bundle definition for {{.project_name}}.
  # See https://docs.databricks.com/dev-tools/bundles/index.html for documentation.
  bundle:
    name: {{.project_name}}

  include:
    - resources/*.yml

  targets:
    # The 'dev' target, used for development purposes.
    # Whenever a developer deploys using 'dev', they get their own copy.
    dev:
      # We use 'mode: development' to make sure everything deployed to this target gets a prefix
      # like '[dev my_user_name]'. Setting this mode also disables any schedules and
      # automatic triggers for jobs and enables the 'development' mode for :re[LDP].
      mode: development
      default: true
      workspace:
        host: {{workspace_host}}

    # The 'prod' target, used for production deployment.
    prod:
      # For production deployments, we only have a single copy, so we override the
      # workspace.root_path default of
      # /Workspace/Users/${workspace.current_user.userName}/.bundle/${bundle.target}/${bundle.name}
      # to a path that is not specific to the current user.
      #
      # By making use of 'mode: production' we enable strict checks
      # to make sure we have correctly configured this target.
      mode: production
      workspace:
        host: {{workspace_host}}
        root_path: /Shared/.bundle/prod/${bundle.name}
      {{- if not is_service_principal}}
      run_as:
        # This runs as {{user_name}} in production. Alternatively,
        # a service principal could be used here using service_principal_name
        # (see Databricks documentation).
        user_name: {{user_name}}
      {{end -}}
```

Create another YAML file named `{{.project_name}}_job.yml.tmpl` and place it in the `template/resources` directory. This new YAML file splits the project job definitions from the rest of the bundle's definition. Add the following YAML to this file to describe the template job, which contains a specific Python task to run on a job cluster using a specific Docker container image:

```sh
  touch template/resources/{{.project_name}}_job.yml.tmpl
```

```yaml
  # The main job for {{.project_name}}
  resources:
    jobs:
      {{.project_name}}_job:
        name: {{.project_name}}_job
        tasks:
          - task_key: python_task
            job_cluster_key: job_cluster
            spark_python_task:
              python_file: ../src/{{.project_name}}/task.py
        job_clusters:
          - job_cluster_key: job_cluster
            new_cluster:
              docker_image:
                url: databricksruntime/python:10.4-LTS
              node_type_id: i3.xlarge
              spark_version: 13.3.x-scala2.12
```

In this example, you use a default Databricks base Docker container image, but you can specify your own custom image instead.

## Add files referenced in your configuration

Next, create a `template/src/{{.project_name}}` directory and create the Python task file referenced by the job in the template:

```sh
  mkdir -p template/src/{{.project_name}}
  touch template/src/{{.project_name}}/task.py
```

Now, add the following to `task.py`:

```python
  import pyspark
  from pyspark.sql import SparkSession

  spark = SparkSession.builder.master('local[*]').appName('example').getOrCreate()

  print(f'Spark version{spark.version}')
```

## Verify the bundle template structure

Review the folder structure of your bundle template project. It should look like this:

```
  .
  ├── databricks_template_schema.json
  └── template
      ├── databricks.yml.tmpl
      ├── resources
      │   └── {{.project_name}}_job.yml.tmpl
      └── src
          └── {{.project_name}}
              └── task.py
```

## Test your template

Finally, test your bundle template. To generate a bundle based on your new custom template, use the `databricks bundle init` command, specifying the new template location. From your bundle projects root folder:

```sh
mkdir my-new-container-bundle
cd my-new-container-bundle
databricks bundle init dab-container-template
```

## Next steps

- Create a bundle that deploys a notebook to :re[a Databricks] workspace and then runs that deployed notebook as :re[a Databricks] job. See [\_](/dev-tools/bundles/jobs-tutorial.md).
- Create a bundle that deploys a notebook to :re[a Databricks] workspace and then runs that deployed notebook as an ETL pipeline. See [\_](/dev-tools/bundles/pipelines-tutorial.md).
- Create a bundle that deploys and runs an MLOps Stack. See [\_](/dev-tools/bundles/mlops-stacks.md).
- Add a bundle to a CI/CD (continuous integration/continuous deployment) workflow in GitHub. See [\_](/dev-tools/bundles/ci-cd-bundles.md).

## Resources

- [Bundle examples repository in GitHub](https://github.com/databricks/bundle-examples)
