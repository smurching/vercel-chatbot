---
description: 'Find bundle configuration examples for common bundle use cases and features, including jobs and pipelines running on serverless.'
last_update:
  date: 2025-08-04
---

# Bundle configuration examples

This article provides example configuration for :re[DABS] features and common bundle use cases.

Complete bundle examples, outlined in the following table, are available in the [bundle-examples GitHub repository](https://github.com/databricks/bundle-examples):

:::list-table

- - Bundle name
  - Description
- - [dashboard_nyc_taxi](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/dashboard_nyc_taxi)
  - A bundle with an AI/BI dashboard and a job that captures a snapshot of the dashboard and emails it to a subscriber
- - [databricks_app](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/databricks_app)
  - A bundle that defines a Databricks App
- - [development_cluster](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/development_cluster)
  - A bundle that defines and uses a development (all-purpose) cluster
- - [job_read_secret](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/job_read_secret)
  - A bundle that defines a secret scope and a job with a task that reads from it
- - [job_with_multiple_wheels](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/job_with_multiple_wheels)
  - A bundle that defines and uses a job with multiple wheel dependencies
- - [job_with_run_job_tasks](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/job_with_run_job_tasks)
  - A bundle with multiple jobs with run job tasks
- - [job_with_sql_notebook](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/job_with_sql_notebook)
  - A bundle with a job that uses a SQL notebook task
- - [pipeline_with_schema](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/pipeline_with_schema)
  - A bundle that defines a Unity Catalog schema and a pipeline that uses it
- - [private_wheel_packages](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/private_wheel_packages)
  - A bundle that uses a private wheel package from a job
- - [python_wheel_poetry](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/python_wheel_poetry)
  - A bundle that builds a `whl` with Poetry
- - [serverless_job](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/serverless_job)
  - A bundle that uses serverless compute to run a job
- - [share_files_across_bundles](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/share_files_across_bundles)
  - A bundle that includes files located outside the bundle root directory.
- - [spark_jar_task](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/spark_jar_task)
  - A bundle that defines and uses a Spark JAR task
- - [write_from_job_to_volume](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/write_from_job_to_volume)
  - A bundle that writes a file to a :re[UC] volume

:::

## Bundle scenarios

This section contains configuration examples that demonstrate using top-level bundle mappings. See [\_](/dev-tools/bundles/reference.md).

### <a id="jar-upload"></a>Bundle that uploads a JAR file to :re[UC]

You can specify :re[UC] volumes as an artifact path so that all artifacts, such as JAR files and wheel files, are uploaded to :re[UC] volumes. The following example bundle builds and uploads a JAR file to :re[UC]. For information on the `artifact_path` mapping, see [\_](/dev-tools/bundles/settings.md#artifact-path). For information on `artifacts`, see [\_](/dev-tools/bundles/settings.md#bundle-syntax-mappings-artifacts).

```yaml
bundle:
  name: jar-bundle

workspace:
  host: https://myworkspace.cloud.databricks.com
  artifact_path: /Volumes/main/default/my_volume

artifacts:
  my_java_code:
    path: ./sample-java
    build: 'javac PrintArgs.java && jar cvfm PrintArgs.jar META-INF/MANIFEST.MF PrintArgs.class'
    files:
      - source: ./sample-java/PrintArgs.jar

resources:
  jobs:
    jar_job:
      name: 'Spark Jar Job'
      tasks:
        - task_key: SparkJarTask
          new_cluster:
            num_workers: 1
            spark_version: '14.3.x-scala2.12'
            node_type_id: 'i3.xlarge'
          spark_jar_task:
            main_class_name: PrintArgs
          libraries:
            - jar: ./sample-java/PrintArgs.jar
```

## <a id="job"></a>Job configuration

This section contains job configuration examples. For job configuration details, see [\_](/dev-tools/bundles/resources.md#job).

### <a id="job-serverless"></a>Job that uses serverless compute

:re[DABS] support jobs that run on [serverless compute](/compute/serverless/index.md). See [\_](/jobs/run-serverless-jobs.md). To configure this, you can either omit the `clusters` setting for a job with a notebook task, or you can specify an environment as shown in the examples below. For Python script, Python wheel, and dbt tasks, `environment_key` is required for serverless compute. See [environment_key](https://docs.databricks.com/api/workspace/jobs/create#tasks-environment_key).

```yaml
# A serverless job (no cluster definition)
resources:
  jobs:
    serverless_job_no_cluster:
      name: serverless_job_no_cluster

      email_notifications:
        on_failure:
          - someone@example.com

      tasks:
        - task_key: notebook_task
          notebook_task:
            notebook_path: ../src/notebook.ipynb
```

```yaml
# A serverless job (environment spec)
resources:
  jobs:
    serverless_job_environment:
      name: serverless_job_environment

      tasks:
        - task_key: task
          spark_python_task:
            python_file: ../src/main.py

          # The key that references an environment spec in a job.
          # https://docs.databricks.com/api/workspace/jobs/create#tasks-environment_key
          environment_key: default

      # A list of task execution environment specifications that can be referenced by tasks of this job.
      environments:
        - environment_key: default

          # Full documentation of this spec can be found at:
          # https://docs.databricks.com/api/workspace/jobs/create#environments-spec
          spec:
            client: '1'
            dependencies:
              - my-library
```

### Job with multiple wheel files

The following example configurations defines a bundle that contains a job with multiple `*.whl` files.

```yaml
# job.yml
resources:
  jobs:
    example_job:
      name: 'Example with multiple wheels'
      tasks:
        - task_key: task

          spark_python_task:
            python_file: ../src/call_wheel.py

          libraries:
            - whl: ../my_custom_wheel1/dist/*.whl
            - whl: ../my_custom_wheel2/dist/*.whl

          new_cluster:
            node_type_id: i3.xlarge
            num_workers: 0
            spark_version: 14.3.x-scala2.12
            spark_conf:
              'spark.databricks.cluster.profile': 'singleNode'
              'spark.master': 'local[*, 4]'
            custom_tags:
              'ResourceClass': 'SingleNode'
```

```yaml
# databricks.yml
bundle:
  name: job_with_multiple_wheels

include:
  - ./resources/job.yml

workspace:
  host: https://myworkspace.cloud.databricks.com

artifacts:
  my_custom_wheel1:
    type: whl
    build: poetry build
    path: ./my_custom_wheel1

  my_custom_wheel2:
    type: whl
    build: poetry build
    path: ./my_custom_wheel2

targets:
  dev:
    default: true
    mode: development
```

### Job that uses a requirements.txt file

The following example configuration defines a job that uses a requirements.txt file.

```yaml
resources:
  jobs:
    job_with_requirements_txt:
      name: 'Example job that uses a requirements.txt file'
      tasks:
        - task_key: task
          job_cluster_key: default
          spark_python_task:
            python_file: ../src/main.py
          libraries:
            - requirements: /Workspace/${workspace.file_path}/requirements.txt
```

### Job on a schedule

The following examples show configuration for jobs that run on a schedule. For information about job schedules and triggers, see [\_](/jobs/triggers.md).

This configuration defines a job that runs daily at a specified time:

```yaml
resources:
  jobs:
    my-notebook-job:
      name: my-notebook-job
      tasks:
        - task_key: my-notebook-task
          notebook_task:
            notebook_path: ./my-notebook.ipynb
      schedule:
        quartz_cron_expression: '0 0 8 * * ?' # daily at 8am
        timezone_id: UTC
        pause_status: UNPAUSED
```

In this configuration, the job runs one week after the job was last run:

```yaml
resources:
  jobs:
    my-notebook-job:
      name: my-notebook-job
      tasks:
        - task_key: my-notebook-task
          notebook_task:
            notebook_path: ./my-notebook.ipynb
      trigger:
        pause_status: UNPAUSED
        periodic:
          interval: 1
          unit: WEEKS
```

## <a id="pipeline"></a>Pipeline configuration

This section contains pipeline configuration examples. For pipeline configuration information, see [\_](/dev-tools/bundles/resources.md#pipeline).

### Pipeline that uses serverless compute

:re[DABS] support pipelines that run on [serverless compute](/compute/serverless/index.md). To configure this, set the pipeline `serverless` setting to `true`. The following example configuration defines a pipeline that runs on serverless compute with dependencies installed, and a job that triggers a refresh of the pipeline every hour.

```yaml
# A pipeline that runs on serverless compute
resources:
  pipelines:
    my_pipeline:
      name: my_pipeline
      target: ${bundle.environment}
      serverless: true
      environment:
        dependencies:
          - 'dist/*.whl'
      catalog: users
      libraries:
        - notebook:
            path: ../src/my_pipeline.ipynb

      configuration:
        bundle.sourcePath: /Workspace/${workspace.file_path}/src
```

```yaml
# This defines a job to refresh a pipeline that is triggered every hour
resources:
  jobs:
    my_job:
      name: my_job

      # Run this job once an hour.
      trigger:
        periodic:
          interval: 1
          unit: HOURS

      email_notifications:
        on_failure:
          - someone@example.com

      tasks:
        - task_key: refresh_pipeline
          pipeline_task:
            pipeline_id: ${resources.pipelines.my_pipeline.id}
```
