---
description: 'Learn about resources supported by Databricks Asset Bundles and how to configure them.'
last_update:
  date: 2025-08-22
---

# :re[DABS] resources

:re[DABS] allows you to specify information about the :re[Databricks] resources used by the bundle in the `resources` mapping in the bundle configuration. See [resources mapping](/dev-tools/bundles/settings.md#resources) and [resources key reference](/dev-tools/bundles/reference.md#resources).

This article outlines supported resource types for bundles and provides details and an example for each supported type. For additional examples, see [\_](/dev-tools/bundles/examples.md).

:::tip

To generate YAML for any existing resource, use the `databricks bundle generate` command. See [\_](/dev-tools/cli/bundle-commands.md#generate).

:::

## <a id="resource-types"></a>Supported resources

The following table lists supported resource types for bundles. Some resources can be created by defining them in a bundle and deploying the bundle, and some resources can only be created by referencing an existing asset to include in the bundle.

Resources are defined using the corresponding [Databricks REST API](https://docs.databricks.com/api/workspace/introduction) object's create operation request payload, where the object's supported fields, expressed as YAML, are the resource's supported properties. Links to documentation for each resource's corresponding payloads are listed in the table.

:::tip

The `databricks bundle validate` command returns warnings if unknown resource properties are found in bundle configuration files.

:::

:::list-table

- - Resource
  - Corresponding REST API object
- - [app](#apps)
  - [App object](https://docs.databricks.com/api/workspace/apps/create)
- - [cluster](#clusters)
  - [Cluster object](https://docs.databricks.com/api/workspace/clusters/create)
- - [dashboard](#dashboards)
  - [Dashboard object](https://docs.databricks.com/api/workspace/lakeview/create)
- - [database_instance](#database_instances)
  - [Database Instance object](https://docs.databricks.com/api/workspace/database/createdatabaseinstance)
- - [database_catalog](#database_catalogs)
  - [Database Catalog object](https://docs.databricks.com/api/workspace/database/createdatabasecatalog)
- - [experiment](#experiments)
  - [Experiment object](https://docs.databricks.com/api/workspace/experiments/createexperiment)
- - [job](#job)
  - [Job object](https://docs.databricks.com/api/workspace/jobs/create)
- - [model (legacy)](#models)
  - [Model (legacy) object](https://docs.databricks.com/api/workspace/modelregistry/createmodel)
- - [model_serving_endpoint](#model_serving_endpoints)
  - [Model serving endpoint object](https://docs.databricks.com/api/workspace/servingendpoints/create)
- - [pipeline](#pipeline)
  - [Pipeline object](https://docs.databricks.com/api/workspace/pipelines/create)
- - [quality_monitor](#quality_monitors)
  - [Quality monitor object](https://docs.databricks.com/api/workspace/qualitymonitors/create)
- - [registered_model](#registered_models) (:re[UC])
  - [Registered model object](https://docs.databricks.com/api/workspace/registeredmodels/create)
- - [schema](#schemas) (:re[UC])
  - [Schema object](https://docs.databricks.com/api/workspace/schemas/create)
- - [secret_scope](#secret_scopes)
  - [Secret scope object](https://docs.databricks.com/api/workspace/secrets/createscope)
- - [volume](#volumes) (:re[UC])
  - [Volume object](https://docs.databricks.com/api/workspace/volumes/create)

:::

## <a id="apps"></a>app

**`Type: Map`**

The app resource defines a [Databricks app](https://docs.databricks.com/api/workspace/apps/create). For information about Databricks Apps, see [\_](/dev-tools/databricks-apps/index.md).

To add an app, specify the settings to define the app, including the required `source_code_path`.

:::tip

You can initialize a bundle with a Streamlit Databricks app using the following command:

```
databricks bundle init https://github.com/databricks/bundle-examples --template-dir contrib/templates/streamlit-app
```

:::

```yaml
apps:
  <app-name>:
    <app-field-name>: <app-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `budget_policy_id`
  - String
  - The budget policy ID for the app.
- - `config`
  - Map
  - Deprecated. Define your app configuration commands and environment variables in the `app.yaml` file instead. See [\_](/dev-tools/databricks-apps/configuration.md).
- - `description`
  - String
  - The description of the app.
- - `name`
  - String
  - The name of the app. The name must contain only lowercase alphanumeric characters and hyphens. It must be unique within the workspace.
- - `permissions`
  - Sequence
  - The app's permissions. See [\_](/dev-tools/bundles/reference.md#permissions).
- - `resources`
  - Sequence
  - The app compute resources. See [\_](#appsnameresources).
- - `source_code_path`
  - String
  - The `./app` local path of the Databricks app source code. This field is required.
- - `user_api_scopes`
  - Sequence
  - The user API scopes.

:::

### apps._name_.resources

**`Type: Sequence`**

The compute resources for the app.

:::list-table

- - Key
  - Type
  - Description
- - `description`
  - String
  - The description of the app resource.
- - `job`
  - Map
  - The settings that identify the job resource to use. See [resources.job](https://docs.databricks.com/api/workspace/apps/create#resources-job).
- - `name`
  - String
  - The name of the app resource.
- - `secret`
  - Map
  - The secret settings. See [resources.secret](https://docs.databricks.com/api/workspace/apps/create#resources-secret).
- - `serving_endpoint`
  - Map
  - The settings that identify the serving endpoint resource to use. See [resources.serving_endpoint](https://docs.databricks.com/api/workspace/apps/create#resources-serving_endpoint).
- - `sql_warehouse`
  - Map
  - The settings that identify the warehouse resource to use. See [resources.sql_warehouse](https://docs.databricks.com/api/workspace/apps/create#resources-sql_warehouse).

:::

#### Example

The following example creates an app named `my_app` that manages a job created by the bundle:

```yaml
resources:
  jobs:
    # Define a job in the bundle
    hello_world:
      name: hello_world
      tasks:
        - task_key: task
          spark_python_task:
            python_file: ../src/main.py
          environment_key: default

      environments:
        - environment_key: default
          spec:
            client: '1'

  # Define an app that manages the job in the bundle
  apps:
    job_manager:
      name: 'job_manager_app'
      description: 'An app which manages a job created by this bundle'

      # The location of the source code for the app
      source_code_path: ../src/app

      # The resources in the bundle which this app has access to. This binds the resource in the app with the bundle resource.
      resources:
        - name: 'app-job'
          job:
            id: ${resources.jobs.hello_world.id}
            permission: 'CAN_MANAGE_RUN'
```

The corresponding `app.yaml` defines the configuration for running the app:

```yaml
command:
  - flask
  - --app
  - app
  - run
  - --debug
env:
  - name: JOB_ID
    valueFrom: 'app-job'
```

For the complete Databricks app example bundle, see the [bundle-examples GitHub repository](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/databricks_app).

## <a id="clusters"></a>cluster

**`Type: Map`**

The cluster resource defines a [cluster](https://docs.databricks.com/api/workspace/clusters/create).

```yaml
clusters:
  <cluster-name>:
    <cluster-field-name>: <cluster-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `apply_policy_default_values`
  - Boolean
  - When set to true, fixed and default values from the policy will be used for fields that are omitted. When set to false, only fixed values from the policy will be applied.
- - `autoscale`
  - Map
  - Parameters needed in order to automatically scale clusters up and down based on load. See [autoscale](https://docs.databricks.com/api/workspace/clusters/create#autoscale).
- - `autotermination_minutes`
  - Integer
  - Automatically terminates the cluster after it is inactive for this time in minutes. If not set, this cluster will not be automatically terminated. If specified, the threshold must be between 10 and 10000 minutes. Users can also set this value to 0 to explicitly disable automatic termination.
- - `aws_attributes`
  - Map
  - Attributes related to clusters running on Amazon Web Services. If not specified at cluster creation, a set of default values will be used. See [aws_attributes](https://docs.databricks.com/api/workspace/clusters/create#aws_attributes).
- - `azure_attributes`
  - Map
  - Attributes related to clusters running on Microsoft Azure. If not specified at cluster creation, a set of default values will be used. See [azure_attributes](https://docs.databricks.com/api/workspace/clusters/create#azure_attributes).
- - `cluster_log_conf`
  - Map
  - The configuration for delivering spark logs to a long-term storage destination. See [cluster_log_conf](https://docs.databricks.com/api/workspace/clusters/create#cluster_log_conf).
- - `cluster_name`
  - String
  - Cluster name requested by the user. This doesn't have to be unique. If not specified at creation, the cluster name will be an empty string.
- - `custom_tags`
  - Map
  - Additional tags for cluster resources. Databricks will tag all cluster resources (e.g., AWS instances and EBS volumes) with these tags in addition to `default_tags`. See [custom_tags](https://docs.databricks.com/api/workspace/clusters/create#custom_tags).
- - `data_security_mode`
  - String
  - The data governance model to use when accessing data from a cluster. See [data_security_mode](https://docs.databricks.com/api/workspace/clusters/create#data_security_mode).
- - `docker_image`
  - Map
  - The custom docker image. See [docker_image](https://docs.databricks.com/api/workspace/clusters/create#docker_image).
- - `driver_instance_pool_id`
  - String
  - The optional ID of the instance pool for the driver of the cluster belongs. The pool cluster uses the instance pool with id (instance_pool_id) if the driver pool is not assigned.
- - `driver_node_type_id`
  - String
  - The node type of the Spark driver. Note that this field is optional; if unset, the driver node type will be set as the same value as `node_type_id` defined above. This field, along with node_type_id, should not be set if virtual_cluster_size is set. If both driver_node_type_id, node_type_id, and virtual_cluster_size are specified, driver_node_type_id and node_type_id take precedence.
- - `enable_elastic_disk`
  - Boolean
  - Autoscaling Local Storage: when enabled, this cluster will dynamically acquire additional disk space when its Spark workers are running low on disk space. This feature requires specific AWS permissions to function correctly - refer to the User Guide for more details.
- - `enable_local_disk_encryption`
  - Boolean
  - Whether to enable LUKS on cluster VMs' local disks
- - `gcp_attributes`
  - Map
  - Attributes related to clusters running on Google Cloud Platform. If not specified at cluster creation, a set of default values will be used. See [gcp_attributes](https://docs.databricks.com/api/workspace/clusters/create#gcp_attributes).
- - `init_scripts`
  - Sequence
  - The configuration for storing init scripts. Any number of destinations can be specified. The scripts are executed sequentially in the order provided. See [init_scripts](https://docs.databricks.com/api/workspace/clusters/create#init_scripts).
- - `instance_pool_id`
  - String
  - The optional ID of the instance pool to which the cluster belongs.
- - `is_single_node`
  - Boolean
  - This field can only be used when `kind = CLASSIC_PREVIEW`. When set to true, Databricks will automatically set single node related `custom_tags`, `spark_conf`, and `num_workers`
- - `kind`
  - String
  - The kind of compute described by this compute specification.
- - `node_type_id`
  - String
  - This field encodes, through a single value, the resources available to each of the Spark nodes in this cluster. For example, the Spark nodes can be provisioned and optimized for memory or compute intensive workloads. A list of available node types can be retrieved by using the :method:clusters/listNodeTypes API call.
- - `num_workers`
  - Integer
  - Number of worker nodes that this cluster should have. A cluster has one Spark Driver and `num_workers` Executors for a total of `num_workers` + 1 Spark nodes.
- - `permissions`
  - Sequence
  - The cluster permissions. See [\_](/dev-tools/bundles/reference.md#permissions).
- - `policy_id`
  - String
  - The ID of the cluster policy used to create the cluster if applicable.
- - `runtime_engine`
  - String
  - Determines the cluster's runtime engine, either `STANDARD` or `PHOTON`.
- - `single_user_name`
  - String
  - Single user name if data_security_mode is `SINGLE_USER`
- - `spark_conf`
  - Map
  - An object containing a set of optional, user-specified Spark configuration key-value pairs. Users can also pass in a string of extra JVM options to the driver and the executors via `spark.driver.extraJavaOptions` and `spark.executor.extraJavaOptions` respectively. See [spark_conf](https://docs.databricks.com/api/workspace/clusters/create#spark_conf).
- - `spark_env_vars`
  - Map
  - An object containing a set of optional, user-specified environment variable key-value pairs.
- - `spark_version`
  - String
  - The Spark version of the cluster, e.g. `3.3.x-scala2.11`. A list of available Spark versions can be retrieved by using the :method:clusters/sparkVersions API call.
- - `ssh_public_keys`
  - Sequence
  - SSH public key contents that will be added to each Spark node in this cluster. The corresponding private keys can be used to login with the user name `ubuntu` on port `2200`. Up to 10 keys can be specified.
- - `use_ml_runtime`
  - Boolean
  - This field can only be used when `kind = CLASSIC_PREVIEW`. `effective_spark_version` is determined by `spark_version` (DBR release), this field `use_ml_runtime`, and whether `node_type_id` is gpu node or not.
- - `workload_type`
  - Map
  - Cluster Attributes showing for clusters workload types. See [workload_type](https://docs.databricks.com/api/workspace/clusters/create#workload_type).

:::

#### Examples

The following example creates a dedicated (single-user) cluster for the current user with :re[DBR] 15.4 LTS and a cluster policy:

```yaml
resources:
  clusters:
    my_cluster:
      num_workers: 0
      node_type_id: 'i3.xlarge'
      driver_node_type_id: 'i3.xlarge'
      spark_version: '15.4.x-scala2.12'
      spark_conf:
        'spark.executor.memory': '2g'
      autotermination_minutes: 60
      enable_elastic_disk: true
      single_user_name: ${workspace.current_user.userName}
      policy_id: '000128DB309672CA'
      enable_local_disk_encryption: false
      data_security_mode: SINGLE_USER
      runtime_engine": STANDARD
```

This example creates a simple cluster `my_cluster` and sets that as the cluster to use to run the notebook in `my_job`:

```yaml
bundle:
  name: clusters

resources:
  clusters:
    my_cluster:
      num_workers: 2
      node_type_id: 'i3.xlarge'
      autoscale:
        min_workers: 2
        max_workers: 7
      spark_version: '13.3.x-scala2.12'
      spark_conf:
        'spark.executor.memory': '2g'

  jobs:
    my_job:
      tasks:
        - task_key: test_task
          notebook_task:
            notebook_path: './src/my_notebook.py'
          existing_cluster_id: ${resources.clusters.my_cluster.id}
```

## <a id="dashboards"></a>dashboard

**`Type: Map`**

The dashboard resource allows you to manage [AI/BI dashboards](https://docs.databricks.com/api/workspace/lakeview/create) in a bundle. For information about AI/BI dashboards, see [\_](/dashboards/index.md).

:::note

When using :re[DABS] with [dashboard Git support](/dashboards/git-support.md), prevent duplicate dashboards from being generated by adding the [sync mapping](/dev-tools/bundles/settings.md#sync) to exclude the dashboards from synchronizing as files:

```yaml
sync:
  exclude:
    - src/*.lvdash.json
```

:::

```yaml
dashboards:
  <dashboard-name>:
    <dashboard-field-name>: <dashboard-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `display_name`
  - String
  - The display name of the dashboard.
- - `etag`
  - String
  - The etag for the dashboard. Can be optionally provided on updates to ensure that the dashboard has not been modified since the last read.
- - `file_path`
  - String
  - The local path of the dashboard asset, including the file name. Exported dashboards always have the file extension `.lvdash.json`.
- - `permissions`
  - Sequence
  - The dashboard permissions. See [\_](/dev-tools/bundles/reference.md#permissions).
- - `serialized_dashboard`
  - Any
  - The contents of the dashboard in serialized string form.
- - `warehouse_id`
  - String
  - The warehouse ID used to run the dashboard.

:::

#### Example

The following example includes and deploys the sample **NYC Taxi Trip Analysis** dashboard to the Databricks workspace.

```yaml
resources:
  dashboards:
    nyc_taxi_trip_analysis:
      display_name: 'NYC Taxi Trip Analysis'
      file_path: ../src/nyc_taxi_trip_analysis.lvdash.json
      warehouse_id: ${var.warehouse_id}
```

If you use the UI to modify the dashboard, modifications made through the UI are not applied to the dashboard JSON file in the local bundle unless you explicitly update it using `bundle generate`. You can use the `--watch` option to continuously poll and retrieve changes to the dashboard. See [\_](/dev-tools/cli/bundle-commands.md#generate).

In addition, if you attempt to deploy a bundle that contains a dashboard JSON file that is different than the one in the remote workspace, an error will occur. To force the deploy and overwrite the dashboard in the remote workspace with the local one, use the `--force` option. See [\_](/dev-tools/cli/bundle-commands.md#deploy).

## <a id="database_catalogs"></a>database_catalogs

**`Type: Map`**

The database catalog resource allows you to define [database catalogs](https://docs.databricks.com/api/workspace/database/createdatabasecatalog) that correspond to database instances in a bundle. A database catalog is a Lakebase database that is registered as a Unity Catalog catalog.

:::aws-azure

For information about database catalogs, see [\_](/oltp/register-uc.md#create-a-catalog).

:::

```yaml
database_catalogs:
  <database_catalog-name>:
    <database_catalog-field-name>: <database_catalog-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `create_database_if_not_exists`
  - Boolean
  - Whether to create the database if it does not exist.
- - `database_instance_name`
  - String
  - The name of the instance housing the database.
- - `database_name`
  - String
  - The name of the database (in a instance) associated with the catalog.
- - `name`
  - String
  - The name of the catalog in :re[UC].

:::

#### Example

The following example defines a [database instance](#database_instances) with a corresponding database catalog:

```yaml
resources:
  database_instances:
    my_instance:
      name: my-instance
      capacity: CU_1
  database_catalogs:
    my_catalog:
      database_instance_name: ${resources.database_instances.my_instance.name}
      name: example_catalog
      database_name: my_database
      create_database_if_not_exists: true
```

## <a id="database_instances"></a>database_instances

**`Type: Map`**

The database instance resource allows you to define [database instances](https://docs.databricks.com/api/workspace/database/createdatabaseinstance) in a bundle. A Lakebase database instance manages storage and compute resources and provides the endpoints that users connect to.

:::important

When you deploy a bundle with a database instance, the instance immediately starts running and is subject to pricing. See [Lakebase pricing](https://www.databricks.com/product/pricing/lakebase).

:::

:::aws-azure

For information about database instances, see [\_](/oltp/instance.md).

:::

```yaml
database_instances:
  <database_instance-name>:
    <database_instance-field-name>: <database_instance-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `capacity`
  - String
  - The sku of the instance. Valid values are `CU_1`, `CU_2`, `CU_4`, `CU_8`.
- - `enable_pg_native_login`
  - Boolean
  - Whether the instance has PG native password login enabled. Defaults to `true`.

- - `enable_readable_secondaries`
  - Boolean
  - Whether to enable secondaries to serve read-only traffic. Defaults to `false`.
- - `name`
  - String
  - The name of the instance. This is the unique identifier for the instance.
- - `node_count`
  - Integer
  - The number of nodes in the instance, composed of 1 primary and 0 or more secondaries. Defaults to 1 primary and 0 secondaries.
- - `parent_instance_ref`
  - Map
  - The ref of the parent instance. This is only available if the instance is child instance. Input: For specifying the parent instance to create a child instance. See [parent instance](https://docs.databricks.com/api/workspace/database/createdatabaseinstance#parent_instance_ref).
- - `permissions`
  - Sequence
  - The database instance's permissions. See [\_](/dev-tools/bundles/reference.md#permissions).
- - `retention_window_in_days`
  - Integer
  - The retention window for the instance. This is the time window in days for which the historical data is retained. The default value is 7 days. Valid values are 2 to 35 days.
- - `stopped`
  - Boolean
  - Whether the instance is stopped.

:::

#### Example

The following example defines a database instance with a corresponding [database catalog](#database_catalogs):

```yaml
resources:
  database_instances:
    my_instance:
      name: my-instance
      capacity: CU_1
  database_catalogs:
    my_catalog:
      database_instance_name: ${resources.database_instances.my_instance.name}
      name: example_catalog
      database_name: my_database
      create_database_if_not_exists: true
```

For an example bundle that demonstrates how to define a database instance and corresponding database catalog, see the [bundle-examples GitHub repository](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/database_with_catalog).

## <a id="experiments"></a>experiment

**`Type: Map`**

The experiment resource allows you to define [MLflow experiments](https://docs.databricks.com/api/workspace/experiments/createexperiment) in a bundle. For information about MLflow experiments, see [\_](/mlflow/experiments.md).

```yaml
experiments:
  <experiment-name>:
    <experiment-field-name>: <experiment-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `artifact_location`
  - String
  - The location where artifacts for the experiment are stored.
- - `name`
  - String
  - The friendly name that identifies the experiment.
- - `permissions`
  - Sequence
  - The experiment's permissions. See [\_](/dev-tools/bundles/reference.md#permissions).
- - `tags`
  - Sequence
  - Additional metadata key-value pairs. See [tags](https://docs.databricks.com/api/workspace/experiments/createexperiment#tags).

:::

#### Example

The following example defines an experiment that all users can view:

```yaml
resources:
  experiments:
    experiment:
      name: my_ml_experiment
      permissions:
        - level: CAN_READ
          group_name: users
      description: MLflow experiment used to track runs
```

## <a id="jobs"></a>job

**`Type: Map`**

The job resource allows you to define [jobs and their corresponding tasks](https://docs.databricks.com/api/workspace/jobs/create) in your bundle. For information about jobs, see [\_](/jobs/index.md). For a tutorial that uses a :re[DABS] template to create a job, see [\_](/dev-tools/bundles/jobs-tutorial.md).

```yaml
jobs:
  <job-name>:
    <job-field-name>: <job-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `budget_policy_id`
  - String
  - The id of the user-specified budget policy to use for this job. If not specified, a default budget policy may be applied when creating or modifying the job. See `effective_budget_policy_id` for the budget policy used by this workload.
- - `continuous`
  - Map
  - An optional continuous property for this job. The continuous property will ensure that there is always one run executing. Only one of `schedule` and `continuous` can be used. See [continuous](https://docs.databricks.com/api/workspace/jobs/create#continuous).
- - `deployment`
  - Map
  - Deployment information for jobs managed by external sources. See [deployment](https://docs.databricks.com/api/workspace/jobs/create#deployment).
- - `description`
  - String
  - An optional description for the job. The maximum length is 27700 characters in UTF-8 encoding.
- - `edit_mode`
  - String
  - Edit mode of the job, either `UI_LOCKED` or `EDITABLE`.
- - `email_notifications`
  - Map
  - An optional set of email addresses that is notified when runs of this job begin or complete as well as when this job is deleted. See [email_notifications](https://docs.databricks.com/api/workspace/jobs/create#email_notifications).
- - `environments`
  - Sequence
  - A list of task execution environment specifications that can be referenced by serverless tasks of this job. An environment is required to be present for serverless tasks. For serverless notebook tasks, the environment is accessible in the notebook environment panel. For other serverless tasks, the task environment is required to be specified using environment_key in the task settings. See [environments](https://docs.databricks.com/api/workspace/jobs/create#environments).
- - `format`
  - String
  - The format of the job.
- - `git_source`
  - Map
  - An optional specification for a remote Git repository containing the source code used by tasks.

    **Important:** The `git_source` field and task `source` field set to `GIT` are not recommended for bundles, because local relative paths may not point to the same content in the Git repository, and bundles expect that a deployed job has the same content as the local copy from where it was deployed.

    Instead, clone the repository locally and set up your bundle project within this repository, so that the source for tasks are the workspace.

- - `health`
  - Map
  - An optional set of health rules that can be defined for this job. See [health](https://docs.databricks.com/api/workspace/jobs/create#health).
- - `job_clusters`
  - Sequence
  - A list of job cluster specifications that can be shared and reused by tasks of this job. See [clusters](#clusters).
- - `max_concurrent_runs`
  - Integer
  - An optional maximum allowed number of concurrent runs of the job. Set this value if you want to be able to execute multiple runs of the same job concurrently. See [max_concurrent_runs](https://docs.databricks.com/api/workspace/jobs/create#max_concurrent_runs).
- - `name`
  - String
  - An optional name for the job. The maximum length is 4096 bytes in UTF-8 encoding.
- - `notification_settings`
  - Map
  - Optional notification settings that are used when sending notifications to each of the `email_notifications` and `webhook_notifications` for this job. See [notification_settings](https://docs.databricks.com/api/workspace/jobs/create#notification_settings).
- - `parameters`
  - Sequence
  - Job-level parameter definitions. See [parameters](https://docs.databricks.com/api/workspace/jobs/create#parameters).
- - `performance_target`
  - String
  - PerformanceTarget defines how performant or cost efficient the execution of run on serverless should be.
- - `permissions`
  - Sequence
  - The job's permissions. See [\_](/dev-tools/bundles/reference.md#permissions).
- - `queue`
  - Map
  - The queue settings of the job. See [queue](https://docs.databricks.com/api/workspace/jobs/create#queue).
- - `run_as`
  - Map
  - Write-only setting. Specifies the user or service principal that the job runs as. If not specified, the job runs as the user who created the job. Either `user_name` or `service_principal_name` should be specified. If not, an error is thrown. See [\_](/dev-tools/bundles/run-as.md).
- - `schedule`
  - Map
  - An optional periodic schedule for this job. The default behavior is that the job only runs when triggered by clicking “Run Now” in the Jobs UI or sending an API request to `runNow`. See [schedule](https://docs.databricks.com/api/workspace/jobs/create#schedule).
- - `tags`
  - Map
  - A map of tags associated with the job. These are forwarded to the cluster as cluster tags for jobs clusters, and are subject to the same limitations as cluster tags. A maximum of 25 tags can be added to the job.
- - `tasks`
  - Sequence
  - A list of task specifications to be executed by this job. See [\_](/dev-tools/bundles/job-task-types.md).
- - `timeout_seconds`
  - Integer
  - An optional timeout applied to each run of this job. A value of `0` means no timeout.
- - `trigger`
  - Map
  - A configuration to trigger a run when certain conditions are met. See [trigger](https://docs.databricks.com/api/workspace/jobs/create#trigger).
- - `webhook_notifications`
  - Map
  - A collection of system notification IDs to notify when runs of this job begin or complete. See [webhook_notifications](https://docs.databricks.com/api/workspace/jobs/create#webhook_notifications).

:::

#### Examples

The following example defines a job with the resource key `hello-job` with one notebook task:

```yaml
resources:
  jobs:
    hello-job:
      name: hello-job
      tasks:
        - task_key: hello-task
          notebook_task:
            notebook_path: ./hello.py
```

The following example defines a job with a SQL notebook:

```yaml
resources:
  jobs:
    job_with_sql_notebook:
      name: 'Job to demonstrate using a SQL notebook with a SQL warehouse'
      tasks:
        - task_key: notebook
          notebook_task:
            notebook_path: ./select.sql
            warehouse_id: 799f096837fzzzz4
```

For additional job configuration examples, see [\_](/dev-tools/bundles/examples.md#job).

For information about defining job tasks and overriding job settings, see:

- [\_](/dev-tools/bundles/job-task-types.md)
- [\_](/dev-tools/bundles/job-task-override.md)
- [\_](/dev-tools/bundles/cluster-override.md)

## <a id="models"></a>model (legacy)

**`Type: Map`**

The model resource allows you to define [legacy models](https://docs.databricks.com/api/workspace/modelregistry/createmodel) in bundles. Databricks recommends you use :re[UC] [registered models](#registered_models) instead.

## <a id="model_serving_endpoints"></a>model_serving_endpoint

**`Type: Map`**

The model_serving_endpoint resource allows you to define [model serving endpoints](https://docs.databricks.com/api/workspace/servingendpoints/create). See [\_](/machine-learning/model-serving/manage-serving-endpoints.md).

```yaml
model_serving_endpoints:
  <model_serving_endpoint-name>:
    <model_serving_endpoint-field-name>: <model_serving_endpoint-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `ai_gateway`
  - Map
  - The AI Gateway configuration for the serving endpoint. NOTE: Only external model and provisioned throughput endpoints are currently supported. See [ai_gateway](https://docs.databricks.com/api/workspace/servingendpoints/create#ai_gateway).
- - `config`
  - Map
  - The core config of the serving endpoint. See [config](https://docs.databricks.com/api/workspace/servingendpoints/create#config).
- - `name`
  - String
  - The name of the serving endpoint. This field is required and must be unique across a Databricks workspace. An endpoint name can consist of alphanumeric characters, dashes, and underscores.
- - `permissions`
  - Sequence
  - The model serving endpoint's permissions. See [\_](/dev-tools/bundles/reference.md#permissions).
- - `rate_limits`
  - Sequence
  - Deprecated. Rate limits to be applied to the serving endpoint. Use AI Gateway to manage rate limits.
- - `route_optimized`
  - Boolean
  - Enable route optimization for the serving endpoint.
- - `tags`
  - Sequence
  - Tags to be attached to the serving endpoint and automatically propagated to billing logs. See [tags](https://docs.databricks.com/api/workspace/servingendpoints/create#tags).

:::

#### Example

The following example defines a :re[UC] model serving endpoint:

```yaml
resources:
  model_serving_endpoints:
    uc_model_serving_endpoint:
      name: 'uc-model-endpoint'
      config:
        served_entities:
          - entity_name: 'myCatalog.mySchema.my-ads-model'
            entity_version: '10'
            workload_size: 'Small'
            scale_to_zero_enabled: 'true'
        traffic_config:
          routes:
            - served_model_name: 'my-ads-model-10'
              traffic_percentage: '100'
      tags:
        - key: 'team'
          value: 'data science'
```

## <a id="pipelines"></a>pipeline

**`Type: Map`**

The pipeline resource allows you to create :re[LDP] [pipelines](https://docs.databricks.com/api/workspace/pipelines/create). For information about pipelines, see [\_](/dlt/index.md). For a tutorial that uses the :re[DABS] template to create a pipeline, see [\_](/dev-tools/bundles/pipelines-tutorial.md).

```yaml
pipelines:
  <pipeline-name>:
    <pipeline-field-name>: <pipeline-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `allow_duplicate_names`
  - Boolean
  - If false, deployment will fail if name conflicts with that of another pipeline.
- - `catalog`
  - String
  - A catalog in Unity Catalog to publish data from this pipeline to. If `target` is specified, tables in this pipeline are published to a `target` schema inside `catalog` (for example, `catalog`.`target`.`table`). If `target` is not specified, no data is published to Unity Catalog.
- - `channel`
  - String
  - The :re[LDP] Release Channel that specifies which version of :re[LDP] to use.
- - `clusters`
  - Sequence
  - The cluster settings for this pipeline deployment. See [\_](#clusters).
- - `configuration`
  - Map
  - The configuration for this pipeline execution.
- - `continuous`
  - Boolean
  - Whether the pipeline is continuous or triggered. This replaces `trigger`.
- - `deployment`
  - Map
  - Deployment type of this pipeline. See [deployment](https://docs.databricks.com/api/workspace/pipelines/create#deployment).
- - `development`
  - Boolean
  - Whether the pipeline is in development mode. Defaults to false.
- - `dry_run`
  - Boolean
  - Whether the pipeline is a dry run pipeline.
- - `edition`
  - String
  - The pipeline product edition.
- - `environment`
  - Map
  - The environment specification for this pipeline used to install dependencies on serverless compute. This key is only supported in Databricks CLI version 0.258 and above.
- - `event_log`
  - Map
  - The event log configuration for this pipeline. See [event_log](https://docs.databricks.com/api/workspace/pipelines/create#event_log).
- - `filters`
  - Map
  - The filters that determine which pipeline packages to include in the deployed graph. See [filters](https://docs.databricks.com/api/workspace/pipelines/create#filters).
- - `id`
  - String
  - Unique identifier for this pipeline.
- - `ingestion_definition`
  - Map
  - The configuration for a managed ingestion pipeline. These settings cannot be used with the `libraries`, `schema`, `target`, or `catalog` settings. See [ingestion_definition](https://docs.databricks.com/api/workspace/pipelines/create#ingestion_definition).
- - `libraries`
  - Sequence
  - Libraries or code needed by this deployment. See [libraries](https://docs.databricks.com/api/workspace/pipelines/create#libraries).
- - `name`
  - String
  - A friendly name for this pipeline.
- - `notifications`
  - Sequence
  - The notification settings for this pipeline. See [notifications](https://docs.databricks.com/api/workspace/pipelines/create#notifications).
- - `permissions`
  - Sequence
  - The pipeline's permissions. See [\_](/dev-tools/bundles/reference.md#permissions).
- - `photon`
  - Boolean
  - Whether Photon is enabled for this pipeline.
- - `schema`
  - String
  - The default schema (database) where tables are read from or published to.
- - `serverless`
  - Boolean
  - Whether serverless compute is enabled for this pipeline.
- - `storage`
  - String
  - The DBFS root directory for storing checkpoints and tables.
- - `target`
  - String
  - Target schema (database) to add tables in this pipeline to. Exactly one of `schema` or `target` must be specified. To publish to Unity Catalog, also specify `catalog`. This legacy field is deprecated for pipeline creation in favor of the `schema` field.

:::

#### Example

The following example defines a pipeline with the resource key `hello-pipeline`:

```yaml
resources:
  pipelines:
    hello-pipeline:
      name: hello-pipeline
      clusters:
        - label: default
          num_workers: 1
      development: true
      continuous: false
      channel: CURRENT
      edition: CORE
      photon: false
      libraries:
        - notebook:
            path: ./pipeline.py
```

For additional pipeline configuration examples, see [\_](/dev-tools/bundles/examples.md#pipeline).

## <a id="quality_monitors"></a>quality_monitor (:re[UC])

**`Type: Map`**

The quality_monitor resource allows you to define a :re[UC] [table monitor](https://docs.databricks.com/api/workspace/qualitymonitors/create). For information about monitors, see [\_](/lakehouse-monitoring/index.md).

```yaml
quality_monitors:
  <quality_monitor-name>:
    <quality_monitor-field-name>: <quality_monitor-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `assets_dir`
  - String
  - The directory to store monitoring assets (e.g. dashboard, metric tables).
- - `baseline_table_name`
  - String
  - Name of the baseline table from which drift metrics are computed from. Columns in the monitored table should also be present in the baseline table.
- - `custom_metrics`
  - Sequence
  - Custom metrics to compute on the monitored table. These can be aggregate metrics, derived metrics (from already computed aggregate metrics), or drift metrics (comparing metrics across time windows). See [custom_metrics](https://docs.databricks.com/api/workspace/qualitymonitors/create#custom_metrics).
- - `inference_log`
  - Map
  - Configuration for monitoring inference logs. See [inference_log](https://docs.databricks.com/api/workspace/qualitymonitors/create#inference_log).
- - `notifications`
  - Map
  - The notification settings for the monitor. See [notifications](https://docs.databricks.com/api/workspace/qualitymonitors/create#notifications).
- - `output_schema_name`
  - String
  - Schema where output metric tables are created.
- - `schedule`
  - Map
  - The schedule for automatically updating and refreshing metric tables. See [schedule](https://docs.databricks.com/api/workspace/qualitymonitors/create#schedule).
- - `skip_builtin_dashboard`
  - Boolean
  - Whether to skip creating a default dashboard summarizing data quality metrics.
- - `slicing_exprs`
  - Sequence
  - List of column expressions to slice data with for targeted analysis. The data is grouped by each expression independently, resulting in a separate slice for each predicate and its complements. For high-cardinality columns, only the top 100 unique values by frequency will generate slices.
- - `snapshot`
  - Map
  - Configuration for monitoring snapshot tables.
- - `table_name`
  - String
  - The full name of the table.
- - `time_series`
  - Map
  - Configuration for monitoring time series tables. See [time_series](https://docs.databricks.com/api/workspace/qualitymonitors/create#time_series).
- - `warehouse_id`
  - String
  - Optional argument to specify the warehouse for dashboard creation. If not specified, the first running warehouse will be used.

:::

#### Examples

For a complete example bundle that defines a `quality_monitor`, see the [mlops_demo bundle](https://github.com/databricks-field-eng/dais-mlops-demo/blob/main/dais_mlops_demo).

The following examples define quality monitors for [InferenceLog](/lakehouse-monitoring/create-monitor-api.md#inferencelog), [TimeSeries](/lakehouse-monitoring/create-monitor-api.md#timeseries), and [Snapshot](/lakehouse-monitoring/create-monitor-api.md#snapshot) profile types.

```yaml
# InferenceLog profile type
resources:
  quality_monitors:
    my_quality_monitor:
      table_name: dev.mlops_schema.predictions
      output_schema_name: ${bundle.target}.mlops_schema
      assets_dir: /Workspace/Users/${workspace.current_user.userName}/databricks_lakehouse_monitoring
      inference_log:
        granularities: [1 day]
        model_id_col: model_id
        prediction_col: prediction
        label_col: price
        problem_type: PROBLEM_TYPE_REGRESSION
        timestamp_col: timestamp
      schedule:
        quartz_cron_expression: 0 0 8 * * ? # Run Every day at 8am
        timezone_id: UTC
```

```yaml
# TimeSeries profile type
resources:
  quality_monitors:
    my_quality_monitor:
      table_name: dev.mlops_schema.predictions
      output_schema_name: ${bundle.target}.mlops_schema
      assets_dir: /Workspace/Users/${workspace.current_user.userName}/databricks_lakehouse_monitoring
      time_series:
        granularities: [30 minutes]
        timestamp_col: timestamp
      schedule:
        quartz_cron_expression: 0 0 8 * * ? # Run Every day at 8am
        timezone_id: UTC
```

```yaml
# Snapshot profile type
resources:
  quality_monitors:
    my_quality_monitor:
      table_name: dev.mlops_schema.predictions
      output_schema_name: ${bundle.target}.mlops_schema
      assets_dir: /Workspace/Users/${workspace.current_user.userName}/databricks_lakehouse_monitoring
      snapshot: {}
      schedule:
        quartz_cron_expression: 0 0 8 * * ? # Run Every day at 8am
        timezone_id: UTC
```

## <a id="registered_models"></a>registered_model (:re[UC])

**`Type: Map`**

The registered model resource allows you to define models in :re[UC]. For information about :re[UC] [registered models](https://docs.databricks.com/api/workspace/registeredmodels/create), see [\_](/machine-learning/manage-model-lifecycle/index.md).

```yaml
registered_models:
  <registered_model-name>:
    <registered_model-field-name>: <registered_model-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `catalog_name`
  - String
  - The name of the catalog where the schema and the registered model reside.
- - `comment`
  - String
  - The comment attached to the registered model.
- - `grants`
  - Sequence
  - The grants associated with the registered model. See [\_](#grants).
- - `name`
  - String
  - The name of the registered model.
- - `schema_name`
  - String
  - The name of the schema where the registered model resides.
- - `storage_location`
  - String
  - The storage location on the cloud under which model version data files are stored.

:::

#### Example

The following example defines a registered model in :re[UC]:

```yaml
resources:
  registered_models:
    model:
      name: my_model
      catalog_name: ${bundle.target}
      schema_name: mlops_schema
      comment: Registered model in Unity Catalog for ${bundle.target} deployment target
      grants:
        - privileges:
            - EXECUTE
          principal: account users
```

## <a id="schemas"></a>schema (:re[UC])

**`Type: Map`**

The schema resource type allows you to define :re[UC] [schemas](https://docs.databricks.com/api/workspace/schemas/create) for tables and other assets in your workflows and pipelines created as part of a bundle. A schema, different from other resource types, has the following limitations:

- The owner of a schema resource is always the deployment user, and cannot be changed. If `run_as` is specified in the bundle, it will be ignored by operations on the schema.
- Only fields supported by the corresponding [Schemas object create API](https://docs.databricks.com/api/workspace/schemas/create) are available for the schema resource. For example, `enable_predictive_optimization` is not supported as it is only available on the [update API](https://docs.databricks.com/api/workspace/schemas/update).

```yaml
schemas:
  <schema-name>:
    <schema-field-name>: <schema-field-value>
```

:::list-table

- - Key
  - Type
  - Description
- - `catalog_name`
  - String
  - The name of the parent catalog.
- - `comment`
  - String
  - A user-provided free-form text description.
- - `grants`
  - Sequence
  - The grants associated with the schema. See [\_](#grants).
- - `name`
  - String
  - The name of schema, relative to the parent catalog.
- - `properties`
  - Map
  - A map of key-value properties attached to the schema.
- - `storage_root`
  - String
  - The storage root URL for managed tables within the schema.

:::

#### Examples

The following example defines a pipeline with the resource key `my_pipeline` that creates a :re[UC] schema with the key `my_schema` as the target:

```yaml
resources:
  pipelines:
    my_pipeline:
      name: test-pipeline-{{.unique_id}}
      libraries:
        - notebook:
            path: ../src/nb.ipynb
        - file:
            path: ../src/range.sql
      development: true
      catalog: ${resources.schemas.my_schema.catalog_name}
      target: ${resources.schemas.my_schema.id}

  schemas:
    my_schema:
      name: test-schema-{{.unique_id}}
      catalog_name: main
      comment: This schema was created by Databricks Asset Bundles.
```

A top-level grants mapping is not supported by :re[DABS], so if you want to set grants for a schema, define the grants for the schema within the `schemas` mapping. For more information about grants, see [\_](/data-governance/unity-catalog/manage-privileges/index.md#grant).

The following example defines a :re[UC] schema with grants:

```yaml
resources:
  schemas:
    my_schema:
      name: test-schema
      grants:
        - principal: users
          privileges:
            - SELECT
        - principal: my_team
          privileges:
            - CAN_MANAGE
      catalog_name: main
```

## <a id="secret_scopes"></a>secret_scope

**`Type: Map`**

The secret_scope resource allows you to define [secret scopes](https://docs.databricks.com/api/azure/workspace/secrets/createscope) in a bundle. For information about secret scopes, see [\_](/security/secrets/index.md).

```yaml
secret_scopes:
  <secret_scope-name>:
    <secret_scope-field-name>: <secret_scope-field-value>
```

:::list-table

- - Key
  - Type
  - Description

- - `backend_type`
  - String
  - The backend type the scope will be created with. If not specified, this defaults to `DATABRICKS`.

- - `keyvault_metadata`
  - Map
  - The metadata for the secret scope if the `backend_type` is `AZURE_KEYVAULT`.

- - `name`
  - String
  - Scope name requested by the user. Scope names are unique.

- - `permissions`
  - Sequence
  - The permissions to apply to the secret scope. Permissions are managed via secret scope ACLs. See [\_](/dev-tools/bundles/reference.md#permissions).

:::

#### Examples

The following example defines a secret scope that uses a key vault backend:

```yaml
resources:
  secret_scopes:
    secret_scope_azure:
      name: test-secrets-azure-backend
      backend_type: 'AZURE_KEYVAULT'
      keyvault_metadata:
        resource_id: my_azure_keyvault_id
        dns_name: my_azure_keyvault_dns_name
```

The following example sets a custom ACL using secret scopes and permissions:

```yaml
resources:
  secret_scopes:
    my_secret_scope:
      name: my_secret_scope
      permissions:
        - user_name: admins
          level: WRITE
        - user_name: users
          level: READ
```

For an example bundle that demonstrates how to define a secret scope and a job with a task that reads from it in a bundle, see the [bundle-examples GitHub repository](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/job_read_secret).

## <a id="volumes"></a>volume (:re[UC])

**`Type: Map`**

The volume resource type allows you to define and create :re[UC] [volumes](https://docs.databricks.com/api/workspace/volumes/create) as part of a bundle. When deploying a bundle with a volume defined, note that:

- A volume cannot be referenced in the `artifact_path` for the bundle until it exists in the workspace. Hence, if you want to use :re[DABS] to create the volume, you must first define the volume in the bundle, deploy it to create the volume, then reference it in the `artifact_path` in subsequent deployments.
- Volumes in the bundle are not prepended with the `dev_${workspace.current_user.short_name}` prefix when the deployment target has `mode: development` configured. However, you can manually configure this prefix. See [\_](/dev-tools/bundles/deployment-modes.md#custom-presets).

```yaml
volumes:
  <volume-name>:
    <volume-field-name>: <volume-field-value>
```

:::list-table

- - Key
  - Type
  - Description

- - `catalog_name`
  - String
  - The name of the catalog of the schema and volume.

- - `comment`
  - String
  - The comment attached to the volume.

- - `grants`
  - Sequence
  - The grants associated with the volume. See [\_](#grants).

- - `name`
  - String
  - The name of the volume.

- - `schema_name`
  - String
  - The name of the schema where the volume is.

- - `storage_location`
  - String
  - The storage location on the cloud.

- - `volume_type`
  - String
  - The volume type, either `EXTERNAL` or `MANAGED`. An external volume is located in the specified external location. A managed volume is located in the default location which is specified by the parent schema, or the parent catalog, or the metastore. See [\_](/volumes/managed-vs-external.md).

:::

#### Example

The following example creates a :re[UC] volume with the key `my_volume_id`:

```yaml
resources:
  volumes:
    my_volume_id:
      catalog_name: main
      name: my_volume
      schema_name: my_schema
```

For an example bundle that runs a job that writes to a file in :re[UC] volume, see the [bundle-examples GitHub repository](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/write_from_job_to_volume).

## Common objects

### grants

**`Type: Sequence`**

:::list-table

- - Key
  - Type
  - Description
- - `principal`
  - String
  - The name of the principal that will be granted privileges.
- - `privileges`
  - Sequence
  - The privileges to grant to the specified entity.

:::
