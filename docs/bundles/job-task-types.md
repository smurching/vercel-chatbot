---
description: 'Learn how to add tasks to jobs in :re[DABS]. Bundles enable programmatic management of :re[Databricks] workflows.'
last_update:
  date: 2025-05-12
---

# Add tasks to jobs in :re[DABS]

This article provides examples of various types of tasks that you can add to Lakeflow Jobs in :re[DABS]. See [\_](/dev-tools/bundles/index.md).

Most job task types have task-specific parameters among their supported settings, but you can also define [job parameters](/jobs/job-parameters.md) that get passed to tasks. Dynamic value references are supported for job parameters, which enable passing values specific to the job run between tasks. See [\_](/jobs/dynamic-value-references.md).

You can also override job task settings. See [\_](/dev-tools/bundles/job-task-override.md).

:::important

The job `git_source` field and task `source` field set to `GIT` are not recommended for bundles, because local relative paths may not point to the same content in the Git repository. Bundles expect that a deployed job has the same files as the local copy from where it was deployed.

Instead, clone the repository locally and set up your bundle project within this repository, so that the source for tasks are the workspace.

:::

:::tip

To quickly generate resource configuration for an existing job using the [Databricks CLI](/dev-tools/cli/index.md), you can use the `bundle generate job` command. See [bundle commands](/dev-tools/cli/bundle-commands.md#generate).

:::

## Notebook task

You use this task to run a notebook. See [\_](/jobs/notebook.md).

The following example adds a notebook task to a job and sets a job parameter named `my_job_run_id`. The path for the notebook to deploy is relative to the configuration file in which this task is declared. The task gets the notebook from its deployed location in the :re[Databricks] workspace.

```yaml
resources:
  jobs:
    my-notebook-job:
      name: my-notebook-job
      tasks:
        - task_key: my-notebook-task
          notebook_task:
            notebook_path: ./my-notebook.ipynb
      parameters:
        - name: my_job_run_id
          default: '{{job.run_id}}'
```

For additional mappings that you can set for this task, see `tasks > notebook_task` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format.

## Python script task

You use this task to run a Python file.

The following example adds a Python script task to a job. The path for the Python file to deploy is relative to the configuration file in which this task is declared. The task gets the Python file from its deployed location in the :re[Databricks] workspace.

```yaml
resources:
  jobs:
    my-python-script-job:
      name: my-python-script-job

      tasks:
        - task_key: my-python-script-task
          spark_python_task:
            python_file: ./my-script.py
```

For additional mappings that you can set for this task, see `tasks > spark_python_task` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format. See also [\_](/jobs/python-script.md).

## Python wheel task

You use this task to run a Python wheel file.

The following example adds a Python wheel task to a job. The path for the Python wheel file to deploy is relative to the configuration file in which this task is declared. See [\_](/dev-tools/bundles/library-dependencies.md).

```yaml
resources:
  jobs:
    my-python-wheel-job:
      name: my-python-wheel-job
      tasks:
        - task_key: my-python-wheel-task
          python_wheel_task:
            entry_point: run
            package_name: my_package
          libraries:
            - whl: ./my_package/dist/my_package-*.whl
```

For additional mappings that you can set for this task, see `tasks > python_wheel_task` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format. See also [\_](/dev-tools/bundles/python-wheel.md) and [\_](/jobs/python-wheel.md).

## JAR task

You use this task to run a JAR. You can reference local JAR libraries or those in a workspace, a :re[UC] volume, or an external cloud storage location. See [\_](/dev-tools/bundles/library-dependencies.md).

For details on how to compile and deploy Scala JAR files on a :re[UC]-enabled cluster in standard access mode, see [\_](/dev-tools/databricks-connect/scala/jar-compile.md).

The following example adds a JAR task to a job. The path for the JAR is to the specified volume location.

```yaml
resources:
  jobs:
    my-jar-job:
      name: my-jar-job
      tasks:
        - task_key: my-jar-task
          spark_jar_task:
            main_class_name: org.example.com.Main
          libraries:
            - jar: /Volumes/main/default/my-volume/my-project-0.1.0-SNAPSHOT.jar
```

For additional mappings that you can set for this task, see `tasks > spark_jar_task` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format. See [\_](/jobs/jar.md).

<!--NOTE: Spark Submit job task should probably not be promoted. It's legacy.-->

<!--NOTE: Need to remove DBFS if this is ever added to docs

## Spark Submit task

You use this task to run the `spark-submit` script on the related \<Databricks\> cluster.

The following example adds a Spark Submit task to a job. This Spark Submit task runs `DFSReadWriteTest` from the \<AS\> examples.

```yaml
# ...
resources:
  jobs:
    my-spark-submit-job:
      name: my-spark-submit-job
      # ...
      tasks:
        - task_key: my-spark-submit-task
          spark_submit_task:
            parameters:
              - "--class"
              - "org.apache.spark.examples.DFSReadWriteTest"
              - "dbfs:/FileStore/libraries/spark_examples_2_12_3_1_1.jar"
              - "/discover/databricks-datasets/README.md"
              - "/FileStore/examples/output/"
          # ...
# ...
```

For additional mappings that you can set for this task, see `tasks \> spark_submit_task` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](/api/workspace/jobs/create) in the REST API reference, expressed in YAML format. See [_](/jobs/spark-submit.md).-->

<!--NOTE: Commenting out the SQL-related tasks. This is because the underlying resources are not yet supported in bundles, and we should not suggest that people refer to resources in the workspace that are not managed by the same bundle.-->

<!--NOTE: SQL dashboard task should probably not be promoted. It's legacy.-->

<!--## SQL dashboard task

You use this task to refresh an existing SQL dashboard. See [_](/sql/user/dashboards/index.md).

The following example adds a SQL dashboard task to a job. This SQL dashboard task uses the specified SQL warehouse to refresh the specified SQL dashboard.

```yaml
# ...
resources:
  jobs:
    my-sql-dashboard-job:
      name: my-sql-dashboard-job
      # ...
      tasks:
        - task_key: my-sql-dashboard-task
          sql_task:
            warehouse_id: 1a111111a1111aa1
            dashboard:
              dashboard_id: 11111111-1111-1111-1111-111111111111
          # ...
# ...
```

To get a SQL warehouse's ID, open the SQL warehouse's settings page, then copy the ID found in parentheses after the name of the warehouse in the **Name** field on the **Overview** tab.

To get a SQL dashboard's ID, open the SQL dashboard in the workspace and then copy the SQL dashboard's ID from your browser's address bar. This is the 36-character string after `/sql/dashboards/` in the URL.

For additional mappings that you can set for this task, see `tasks \> sql_task \> dashboard` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](/api/workspace/jobs/create) in the REST API reference, expressed in YAML format. See [_](/jobs/sql.md).

SQL query task

You use this task to run an existing SQL query. See [_](/sql/user/queries/index.md).

The following example adds a SQL query task to a job. This SQL query task uses the specified SQL warehouse to run the specified SQL query.

```yaml
# ...
resources:
  jobs:
    my-sql-query-job:
      name: my-sql-query-job
      # ...
      tasks:
        - task_key: my-sql-query-task
          sql_task:
            warehouse_id: 1a111111a1111aa1
            query:
              query_id: 11111111-1111-1111-1111-111111111111
          # ...
# ...
```

To get a SQL warehouse's ID, open the SQL warehouse's settings page, then copy the ID found in parentheses after the name of the warehouse in the **Name** field on the **Overview** tab.

To get a SQL query's ID, open the SQL query in the workspace and then copy the SQL query's ID from your browser's address bar. This is the 36-character string after `/sql/editor/` in the URL.

For additional mappings that you can set for this task, see `tasks \> sql_task \> query` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](/api/workspace/jobs/create) in the REST API reference, expressed in YAML format. See [_](/jobs/sql.md).

## SQL alert task

You use this task to refresh an existing SQL alert. See [_](/sql/user/alerts/index.md).

The following example adds a SQL alert task to a job. This SQL alert task uses the specified SQL warehouse to refresh the specified SQL alert.

```yaml
# ...
resources:
  jobs:
    my-sql-file-job:
      name: my-sql-alert-job
      # ...
      tasks:
        - task_key: my-sql-alert-task
          sql_task:
            warehouse_id: 1a111111a1111aa1
            alert:
              alert_id: 11111111-1111-1111-1111-111111111111
          # ...
# ...
```

To get a SQL warehouse's ID, open the SQL warehouse's settings page, then copy the ID found in parentheses after the name of the warehouse in the **Name** field on the **Overview** tab.

To get a SQL alert's ID, open the SQL alert in the workspace and then copy the SQL alert's ID from your browser's address bar. This is the 36-character string after `/sql/alerts/` in the URL.

For additional mappings that you can set for this task, see `tasks \> sql_task \> alert` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](/api/workspace/jobs/create) in the REST API reference, expressed in YAML format. See [_](/jobs/sql.md).-->

## SQL file task

You use this task to run a SQL file located in a workspace or a remote Git repository.

The following example adds a SQL file task to a job. This SQL file task uses the specified SQL warehouse to run the specified SQL file.

```yaml
resources:
  jobs:
    my-sql-file-job:
      name: my-sql-file-job
      tasks:
        - task_key: my-sql-file-task
          sql_task:
            file:
              path: /Users/someone@example.com/hello-world.sql
              source: WORKSPACE
            warehouse_id: 1a111111a1111aa1
```

To get a SQL warehouse's ID, open the SQL warehouse's settings page, then copy the ID found in parentheses after the name of the warehouse in the **Name** field on the **Overview** tab.

For additional mappings that you can set for this task, see `tasks > sql_task > file` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format. See [\_](/jobs/sql.md).

## Pipeline task

You use this task to run a pipeline. See [\_](/dlt/index.md).

The following example adds a pipeline task to a job. This task runs the specified pipeline.

```yaml
resources:
  jobs:
    my-pipeline-job:
      name: my-pipeline-job
      tasks:
        - task_key: my-pipeline-task
          pipeline_task:
            pipeline_id: 11111111-1111-1111-1111-111111111111
```

You can get a pipelines's ID by opening the pipeline in the workspace and copying the **Pipeline ID** value on the **Pipeline details** tab of the pipeline's settings page.

For additional mappings that you can set for this task, see `tasks > pipeline_task` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format. See [\_](/jobs/pipeline.md).

## Dashboard task

You use this task to refresh a dashboard and send a snapshot to subscribers. For more information about the dashboard task, see [\_](/jobs/dashboard.md).

The following example adds a dashboard task to a job. When the job is run, the dashboard with the specified ID is refreshed.

```yaml
resources:
  jobs:
    my-dashboard-job:
      name: my-dashboard-job
      tasks:
        - task_key: my-dashboard-task
          dashboard_task:
            dashboard_id: 11111111-1111-1111-1111-111111111111
```

For additional mappings that you can set for this task, see `tasks > dashboard_task` in the create job operation’s request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format.

## dbt task

You use this task to run one or more dbt commands. See [\_](/partners/prep/dbt-cloud.md).

The following example adds a dbt task to a job. This dbt task uses the specified SQL warehouse to run the specified dbt commands.

```yaml
resources:
  jobs:
    my-dbt-job:
      name: my-dbt-job
      tasks:
        - task_key: my-dbt-task
          dbt_task:
            commands:
              - 'dbt deps'
              - 'dbt seed'
              - 'dbt run'
            project_directory: /Users/someone@example.com/Testing
            warehouse_id: 1a111111a1111aa1
          libraries:
            - pypi:
                package: 'dbt-databricks>=1.0.0,<2.0.0'
```

To get a SQL warehouse's ID, open the SQL warehouse's settings page, then copy the ID found in parentheses after the name of the warehouse in the **Name** field on the **Overview** tab.

For additional mappings that you can set for this task, see `tasks > dbt_task` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format. See [\_](/jobs/dbt.md).

:re[DABS] also includes a `dbt-sql` project template that defines a job with a dbt task, as well as dbt profiles for deployed dbt jobs. For information about :re[DABS] templates, see [\_](/dev-tools/bundles/templates.md#default-templates).

## If/else condition task

The `condition_task` enables you to add a task with if/else conditional logic to your job. The task evaluates a condition that can be used to control the execution of other tasks. The condition task does not require a cluster to execute and does not support retries or notifications. For more information about the if/else task, see [\_](/jobs/if-else.md).

The following example contains a condition task and a notebook task, where the notebook task only executes if the number of job repairs is less than 5.

```yaml
resources:
  jobs:
    my-job:
      name: my-job
      tasks:
        - task_key: condition_task
          condition_task:
            op: LESS_THAN
            left: '{{job.repair_count}}'
            right: '5'
        - task_key: notebook_task
          depends_on:
            - task_key: condition_task
              outcome: 'true'
          notebook_task:
            notebook_path: ../src/notebook.ipynb
```

For additional mappings that you can set for this task, see `tasks > condition_task` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format.

## For each task

The `for_each_task` enables you to add a task with a for each loop to your job. The task executes a nested task for every input provided. For more information about the `for_each_task`, see [\_](/jobs/for-each.md).

The following example adds a `for_each_task` to a job, where it loops over the values of another task and processes them.

```yaml
resources:
  jobs:
    my_job:
      name: my_job
      tasks:
        - task_key: generate_countries_list
          notebook_task:
            notebook_path: ../src/generate_countries_list.ipnyb
        - task_key: process_countries
          depends_on:
            - task_key: generate_countries_list
          for_each_task:
            inputs: '{{tasks.generate_countries_list.values.countries}}'
            task:
              task_key: process_countries_iteration
              notebook_task:
                notebook_path: ../src/process_countries_notebook.ipnyb
```

For additional mappings that you can set for this task, see `tasks > for_each_task` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format.

## Run job task

You use this task to run another job.

The following example contains a run job task in the second job that runs the first job.

```yaml
resources:
  jobs:
    my-first-job:
      name: my-first-job
      tasks:
        - task_key: my-first-job-task
          new_cluster:
            spark_version: '13.3.x-scala2.12'
            node_type_id: 'i3.xlarge'
            num_workers: 2
          notebook_task:
            notebook_path: ./src/test.py
    my_second_job:
      name: my-second-job
      tasks:
        - task_key: my-second-job-task
          run_job_task:
            job_id: ${resources.jobs.my-first-job.id}
```

This example uses a [substitution](/dev-tools/bundles/variables.md#substitutions) to retrieve the ID of the job to run. To get a job's ID from the UI, open the job in the workspace and copy the ID from the **Job ID** value in the **Job details** tab of the jobs's settings page.

For additional mappings that you can set for this task, see `tasks > run_job_task` in the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format.
