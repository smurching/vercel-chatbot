---
description: 'Learn about :re[DABS] configuration file syntax. Bundles enable programmatic management of :re[Databricks] workflows.'
last_update:
  date: 2025-08-21
---

# Databricks Asset Bundle configuration

This article describes the syntax for Databricks Asset Bundle configuration files, which define :re[DABS]. See [\_](/dev-tools/bundles/index.md).

To create and work with bundles, see [\_](/dev-tools/bundles/work-tasks.md).

## <a id="bundle-syntax-overview"></a>databricks.yml

A bundle must contain one (and only one) configuration file named `databricks.yml` at the root of the bundle project folder. `databricks.yml` is the main configuration file that defines a bundle, but it can reference other configuration files, such as resource configuration files, in the `include` mapping. Bundle configuration is expressed in YAML. For more information about YAML, see the official YAML [specification](https://yaml.org/spec/).

The simplest `databricks.yml` defines the bundle name, which is within the required top-level mapping [\_](#bundle-mappings), and a target deployment.

```yaml
bundle:
  name: my_bundle

targets:
  dev:
    default: true
```

For details on all top-level mappings, see [\_](#bundle-syntax-mappings).

:::tip

:re[python-dabs] enables you to define resources in Python. See [\_](/dev-tools/bundles/python/index.md).

:::

### Specification

The following YAML specification provides top-level configuration keys for :re[DABS]. For configuration reference, see [\_](/dev-tools/bundles/reference.md).

```yaml
# This is the default bundle configuration if not otherwise overridden in
# the "targets" top-level mapping.
bundle: # Required.
  name: string # Required.
  databricks_cli_version: string
  cluster_id: string
  deployment: Map
  git:
    origin_url: string
    branch: string

# This is the identity to use to run the bundle
run_as:
  - user_name: <user-name>
  - service_principal_name: <service-principal-name>

# These are any additional configuration files to include.
include:
  - '<some-file-or-path-glob-to-include>'
  - '<another-file-or-path-glob-to-include>'

# These are any scripts that can be run.
scripts:
  <some-unique-script-name>:
    content: string

# These are any additional files or paths to include or exclude.
sync:
  include:
    - '<some-file-or-path-glob-to-include>'
    - '<another-file-or-path-glob-to-include>'
  exclude:
    - '<some-file-or-path-glob-to-exclude>'
    - '<another-file-or-path-glob-to-exclude>'
  paths:
    - '<some-file-or-path-to-synchronize>'

# These are the default artifact settings if not otherwise overridden in
# the targets top-level mapping.
artifacts:
  <some-unique-artifact-identifier>:
    build: string
    dynamic_version: boolean
    executable: string
    files:
      - source: string
    path: string
    type: string

# These are for any custom variables for use throughout the bundle.
variables:
  <some-unique-variable-name>:
    description: string
    default: string or complex
    lookup: Map
    type: string

# These are the default workspace settings if not otherwise overridden in
# the targets top-level mapping.
workspace:
  artifact_path: string
  auth_type: string
  azure_client_id: string # For Azure Databricks only.
  azure_environment: string # For Azure Databricks only.
  azure_login_app_id: string # For Azure Databricks only. Reserved for future use.
  azure_tenant_id: string # For Azure Databricks only.
  azure_use_msi: true | false # For Azure Databricks only.
  azure_workspace_resource_id: string # For Azure Databricks only.
  client_id: string # For Databricks on AWS only.
  file_path: string
  google_service_account: string # For Databricks on Google Cloud only.
  host: string
  profile: string
  resource_path: string
  root_path: string
  state_path: string

# These are the permissions to apply to resources defined
# in the resources mapping.
permissions:
  - level: <permission-level>
    group_name: <unique-group-name>
  - level: <permission-level>
    user_name: <unique-user-name>
  - level: <permission-level>
    service_principal_name: <unique-principal-name>

# These are the resource settings if not otherwise overridden in
# the targets top-level mapping.
resources:
  apps:
    <unique-app-name>:
      # See the REST API create request payload reference for apps.
  clusters:
    <unique-cluster-name>:
      # See the REST API create request payload reference for clusters.
  dashboards:
    <unique-dashboard-name>:
      # See the REST API create request payload reference for dashboards.
  experiments:
    <unique-experiment-name>:
      # See the REST API create request payload reference for experiments.
  jobs:
    <unique-job-name>:
      # See REST API create request payload reference for jobs.
  model_serving_endpoint:
    <unique-model-serving-endpoint-name>:
    # See the model serving endpoint request payload reference.
  models:
    <unique-model-name>:
      # See the REST API create request payload reference for models (legacy).
  pipelines:
    <unique-pipeline-name>:
      # See the REST API create request payload reference for :re[LDP] (pipelines).
  quality_monitors:
    <unique-quality-monitor-name>:
    # See the quality monitor request payload reference.
  registered_models:
    <unique-registered-model-name>:
    # See the registered model request payload reference.
  schemas:
    <unique-schema-name>:
      # See the Unity Catalog schema request payload reference.
  secret_scopes:
    <unique-secret-scope-name>:
      # See the secret scope request payload reference.
  volumes:
    <unique-volume-name>:
    # See the Unity Catalog volume request payload reference.

# These are the targets to use for deployments and workflow runs. One and only one of these
# targets can be set to "default: true".
targets:
  <some-unique-programmatic-identifier-for-this-target>:
    artifacts:
      # See the preceding "artifacts" syntax.
    bundle:
      # See the preceding "bundle" syntax.
    default: boolean
    git: Map
    mode: string
    permissions:
      # See the preceding "permissions" syntax.
    presets:
      <preset>: <value>
    resources:
      # See the preceding "resources" syntax.
    sync:
      # See the preceding "sync" syntax.
    variables:
      <preceding-unique-variable-name>: <non-default-value>
    workspace:
      # See the preceding "workspace" syntax.
    run_as:
      # See the preceding "run_as" syntax.
```

## <a id="bundle-syntax-examples"></a>Examples

This section contains some basic examples to help you understand how bundles work and how to structure the configuration.

:::note

For configuration examples that demonstrate bundle features and common bundle use cases, see [\_](/dev-tools/bundles/examples.md) and the [bundle examples repository in GitHub](https://github.com/databricks/bundle-examples).

:::

The following example bundle configuration specifies a local file named `hello.py` that is in the same directory as bundle configuration file `databricks.yml`. It runs this notebook as a job using the remote cluster with the specified cluster ID. The remote workspace URL and workspace authentication credentials are read from the caller's local [configuration profile](/dev-tools/auth/config-profiles.md) named `DEFAULT`.

```yaml
bundle:
  name: hello-bundle

resources:
  jobs:
    hello-job:
      name: hello-job
      tasks:
        - task_key: hello-task
          existing_cluster_id: 1234-567890-abcde123
          notebook_task:
            notebook_path: ./hello.py

targets:
  dev:
    default: true
```

The following example adds a target with the name `prod` that uses a different remote workspace URL and workspace authentication credentials, which are read from the caller's `.databrickscfg` file's matching `host` entry with the specified workspace URL. This job runs the same notebook but uses a different remote cluster with the specified cluster ID.

:::note

Databricks recommends that you use the `host` mapping instead of the `default` mapping wherever possible, as this makes your bundle configuration files more portable. Setting the `host` mapping instructs the Databricks CLI to find a matching profile in your `.databrickscfg` file and then use that profile's fields to determine which Databricks authentication type to use. If multiple profiles with a matching `host` field exist, then you must use the `--profile` option on bundle commands to specify a profile to use.

:::

Notice that you do not need to declare the `notebook_task` mapping within the `prod` mapping, as it falls back to use the `notebook_task` mapping within the top-level `resources` mapping, if the `notebook_task` mapping is not explicitly overridden within the `prod` mapping.

```yaml
bundle:
  name: hello-bundle

resources:
  jobs:
    hello-job:
      name: hello-job
      tasks:
        - task_key: hello-task
          existing_cluster_id: 1234-567890-abcde123
          notebook_task:
            notebook_path: ./hello.py

targets:
  dev:
    default: true
  prod:
    workspace:
      host: https://<production-workspace-url>
    resources:
      jobs:
        hello-job:
          name: hello-job
          tasks:
            - task_key: hello-task
              existing_cluster_id: 2345-678901-fabcd456
```

Use the following [bundle commands](/dev-tools/cli/bundle-commands.md) to validate, deploy, and run this job within the `dev` target. For details about the lifecycle of a bundle, see [\_](/dev-tools/bundles/work-tasks.md).

```bash
# Because the "dev" target is set to "default: true",
# you do not need to specify "-t dev":
databricks bundle validate
databricks bundle deploy
databricks bundle run hello_job

# But you can still explicitly specify it, if you want or need to:
databricks bundle validate
databricks bundle deploy -t dev
databricks bundle run -t dev hello_job
```

To validate, deploy, and run this job within the `prod` target instead:

```bash
# You must specify "-t prod", because the "dev" target
# is already set to "default: true":
databricks bundle validate
databricks bundle deploy -t prod
databricks bundle run -t prod hello_job
```

For more modularization and better reuse of definitions and settings across bundles, split your bundle configuration into separate files:

```yaml
# databricks.yml

bundle:
  name: hello-bundle

include:
  - '*.yml'
```

```yaml
# hello-job.yml

resources:
  jobs:
    hello-job:
      name: hello-job
      tasks:
        - task_key: hello-task
          existing_cluster_id: 1234-567890-abcde123
          notebook_task:
            notebook_path: ./hello.py
```

```yaml
# targets.yml

targets:
  dev:
    default: true
  prod:
    workspace:
      host: https://<production-workspace-url>
    resources:
      jobs:
        hello-job:
          name: hello-job
          tasks:
            - task_key: hello-task
              existing_cluster_id: 2345-678901-fabcd456
```

## <a id="bundle-syntax-mappings"></a>Mappings

The following sections describe the bundle configuration top-level mappings. For configuration reference, see [\_](/dev-tools/bundles/reference.md).

::section-toc{depth=1}

### <a id="bundle-mappings"></a>bundle

A bundle configuration file must contain only one top-level `bundle` mapping that associates the bundle's contents and :re[Databricks] workspace settings.

This `bundle` mapping must contain a `name` mapping that specifies a programmatic (or logical) name for the bundle. The following example declares a bundle with the programmatic (or logical) name `hello-bundle`.

```yaml
bundle:
  name: hello-bundle
```

A `bundle` mapping can also be a child of one or more of the targets in the top-level [\_](#bundle-syntax-mappings-targets) mapping. Each of these child `bundle` mappings specify any non-default overrides at the target level. However, the top-level `bundle` mapping's `name` value cannot be overridden at the target level.

#### <a id="bundle-cluster-id"></a>cluster_id

The `bundle` mapping can have a child `cluster_id` mapping. This mapping enables you to specify the ID of a cluster to use as an override for clusters defined elsewhere in the bundle configuration file. For information about how to retrieve the ID of a cluster, see [\_](/workspace/workspace-details.md#cluster-url).

The `cluster_id` override is intended for development-only scenarios and is only supported for the target that has its `mode` mapping set to `development`. For more information about the `target` mapping, see [\_](#bundle-syntax-mappings-targets).

#### <a id="bundle-compute-id"></a>compute_id

:::note

This setting is deprecated. Use [cluster_id](#bundle-cluster-id) instead.

:::

The `bundle` mapping can have a child `compute_id` mapping. This mapping enables you to specify the ID of a cluster to use as an override for clusters defined elsewhere in the bundle configuration file.

#### <a id="bundle-git"></a>git

You can retrieve and override Git version control details associated with your bundle, which is useful for propagating deployment metadata that can be used later to identify resources. For example, you can trace the repository origin of a job deployed by CI/CD.

Whenever you run a `bundle` command such as `validate`, `deploy` or `run`, the `bundle` command populates the command's configuration tree with the following default settings:

- `bundle.git.origin_url`, which represents the origin URL of the repo. This is the same value that you would get if you ran the command `git config --get remote.origin.url` from your cloned repo. You can use [substitutions](/dev-tools/bundles/variables.md#substitutions) to refer to this value with your bundle configuration files, as `${bundle.git.origin_url}`.
- `bundle.git.branch`, which represents the current branch within the repo. This is the same value that you would get if you ran the command `git branch --show-current` from your cloned repo. You can use [substitutions](/dev-tools/bundles/variables.md#substitutions) to refer to this value with your bundle configuration files, as `${bundle.git.branch}`.

To retrieve or override Git settings, your bundle must be within a directory that is associated with a Git repository, for example a local directory that is initialized by running the `git clone` command. If the directory is not associated with a Git repository, these Git settings are empty.

You can override the `origin_url` and `branch` settings within the `git` mapping of your top-level `bundle` mapping if needed, as follows:

```yaml
bundle:
  git:
    origin_url: <some-non-default-origin-url>
    branch: <some-non-current-branch-name>
```

#### <a id="bundle-databricks-cli-version"></a>databricks_cli_version

The `bundle` mapping can contain a `databricks_cli_version` mapping that constrains the Databricks CLI version required by the bundle. This can prevent issues caused by using mappings that are not supported in a certain version of the Databricks CLI.

The Databricks CLI version conforms to [semantic versioning](https://semver.org/) and the `databricks_cli_version` mapping supports specifying [version constraints](https://github.com/Masterminds/semver?tab=readme-ov-file#checking-version-constraints). If the current `databricks --version` value is not within the bounds specified in the bundle's `databricks_cli_version` mapping, an error occurs when `databricks bundle validate` is executed on the bundle. The following examples demonstrate some common version constraint syntax:

```yaml
bundle:
  name: hello-bundle
  databricks_cli_version: '0.218.0' # require Databricks CLI 0.218.0
```

```yaml
bundle:
  name: hello-bundle
  databricks_cli_version: '0.218.*' # allow all patch versions of Databricks CLI 0.218
```

```yaml
bundle:
  name: my-bundle
  databricks_cli_version: '>= 0.218.0' # allow any version of Databricks CLI 0.218.0 or higher
```

```yaml
bundle:
  name: my-bundle
  databricks_cli_version: '>= 0.218.0, <= 1.0.0' # allow any Databricks CLI version between 0.218.0 and 1.0.0, inclusive
```

### <a id="bundle-syntax-mappings-runas"></a>run_as

The `run_as` setting specifies the `user_name` or `service_principal_name` to use to run the bundle. It provides the ability to separate the identity used to deploy a bundle job or pipeline from the one used to run the job or pipeline.

See [\_](/dev-tools/bundles/run-as.md).

### <a id="bundle-syntax-mappings-include"></a>include

The `include` array specifies a list of path globs that contain configuration files to include within the bundle. These path globs are relative to the location of the bundle configuration file in which the path globs are specified.

The Databricks CLI does not include any configuration files by default within the bundle. You must use the `include` array to specify any and all configuration files to include within the bundle, other than the `databricks.yml` file itself.

This `include` array can appear only as a top-level mapping.

The following example configuration includes three configuration files. These files are in the same folder as the bundle configuration file:

```yaml
include:
  - 'bundle.artifacts.yml'
  - 'bundle.resources.yml'
  - 'bundle.targets.yml'
```

The following example configuration includes all files with filenames that begin with `bundle` and end with `.yml`. These files are in the same folder as the bundle configuration file:

```yaml
include:
  - 'bundle*.yml'
```

### <a id="bundle-syntax-mappings-scripts"></a>scripts

The `scripts` setting specifies scripts that can be run using `bundle run`. Each named script in the `scripts` mapping contains content with commands. For example:

```yaml
scripts:
  my_script:
    content: uv run pytest -m ${bundle.target}
```

For more information, see [\_](/dev-tools/cli/bundle-commands.md#scripts).

### <a id="bundle-syntax-mappings-sync"></a>sync

The `sync` mapping allows you to configure which files are part of your bundle deployments.

#### include and exclude

The `include` and `exclude` mappings within the `sync` mapping specifies a list of files or folders to include within, or exclude from, bundle deployments, depending on the following rules:

- Based on any list of file and path globs in a `.gitignore` file in the bundle's root, the `include` mapping can contain a list of file globs, path globs, or both, relative to the bundle's root, to explicitly include.
- Based on any list of file and path globs in a `.gitignore` file in the bundle's root, plus the list of file and path globs in the `include` mapping, the `exclude` mapping can contain a list of file globs, path globs, or both, relative to the bundle's root, to explicitly exclude.

All paths to specified files and folders are relative to the location of the bundle configuration file in which they are specified.

The syntax for `include` and `exclude` file and path patterns follow standard `.gitignore` pattern syntax. See [gitignore Pattern Format](https://git-scm.com/docs/gitignore#_pattern_format).

For example, if the following `.gitignore` file contains the following entries:

```
.databricks
my_package/dist
```

And the bundle configuration file contains the following `include` mapping:

```yaml
sync:
  include:
    - my_package/dist/*.whl
```

Then all of the files in the `my_package/dist` folder with a file extension of `*.whl` are included. Any other files in the `my_package/dist` folder are not included.

However, if the bundle configuration file also contains the following `exclude` mapping:

```yaml
sync:
  include:
    - my_package/dist/*.whl
  exclude:
    - my_package/dist/delete-me.whl
```

Then all of the files in the `my_package/dist` folder with a file extension of `*.whl`, except for the file named `delete-me.whl`, are included. Any other files in the `my_package/dist` folder are also not included.

The `sync` mapping can also be declared in the `targets` mapping for a specific target. Any `sync` mapping declared in a target is merged with any top-level `sync` mapping declarations. For example, continuing with the preceding example, the following `include` mapping at the `targets` level merges with the `include` mapping in the top-level `sync` mapping:

```yaml
targets:
  dev:
    sync:
      include:
        - my_package/dist/delete-me.whl
```

#### paths

The `sync` mapping can contain a `paths` mapping that specifies local paths to synchronize to the workspace. The `paths` mapping allows you to share common files across bundles, and can be used to sync files located outside of the bundle root. (The bundle root is the location of the databricks.yml file.) This is especially useful when you have a single repository that hosts multiple bundles and want to share libraries, code files, or configuration.

Specified paths must be relative to files and directories anchored at the folder where the `paths` mapping is set. If one or more path values traverse up the directory to an ancestor of the bundle root, the root path is dynamically determined to ensure that the folder structure remains intact. For example, if the bundle root folder is named `my_bundle` then this configuration in `databricks.yml` syncs the `common` folder located one level above the bundle root and the bundle root itself:

```yaml
sync:
  paths:
    - ../common
    - .
```

A deploy of this bundle results in the following folder structure in the workspace:

```
common/
  common_file.txt
my_bundle/
  databricks.yml
  src/
    ...
```

### <a id="bundle-syntax-mappings-artifacts"></a>artifacts

The top-level `artifacts` mapping specifies one or more artifacts that are automatically built during bundle deployments and can be used later in bundle runs. Each child artifact supports the following mappings:

- `type` is required for Python wheel builds. To build a Python wheel file before deploying, set this to `whl`. To build other artifacts, this setting does not need to be specified.
- `path` is an optional path. Paths are relative to the location of the bundle configuration file. For Python wheel builds, it is the path to the Python wheel file's `setup.py` file. If `path` is not included, the Databricks CLI attempts to find the Python wheel file's `setup.py` file in the bundle's root.
- `files` is an optional mapping that includes a child `source` mapping, which you can use to specify the built artifacts. Paths are relative to the location of the bundle configuration file.
- `build` is an optional set of non-default build commands that you want to run locally before deployment. For Python wheel builds, the Databricks CLI assumes that it can find a local install of the Python `wheel` package to run builds, and it runs the command `python setup.py bdist_wheel` by default during each bundle deployment. Specify multiple build commands on separate lines.
- `dynamic_version` enables bundles to update the wheel version based on the timestamp of the wheel file. New code can then be deployed without having to update the version in `setup.py` or `pyproject.toml`. This setting is only valid when `type` is set to `whl`.

The following example configuration runs tests and builds a wheel. For a complete bundle tutorial that uses `artifacts` to build a wheel, see [\_](/dev-tools/bundles/python-wheel.md).

```yaml
artifacts:
  default:
    type: whl
    build: |-
      # run tests
      python -m pytest tests/ -v

      # build the actual artifact
      python setup.py bdist_wheel

    path: .
```

For an example configuration that builds a JAR and uploads it to :re[UC], see [\_](/dev-tools/bundles/examples.md#jar-upload).

:::tip

You can define, combine, and override the settings for artifacts in bundles as described in [\_](/dev-tools/bundles/artifact-overrides.md).

:::

### <a id="variables-mappings"></a>variables

The bundles settings file can contain one top-level `variables` mapping where custom variables are defined. For each variable, set an optional description, default value, whether the custom variable is a complex type, or lookup to retrieve an ID value, using the following format:

```yaml
variables:
  <variable-name>:
    description: <variable-description>
    default: <optional-default-value>
    type: <optional-type-value> # "complex" is the only valid value
    lookup:
      <optional-object-type>: <optional-object-name>
```

:::note

Variables are assumed to be of type `string`, unless `type` is set to `complex`. See [\_](/dev-tools/bundles/variables.md#complex-variables).

:::

To reference a custom variable within bundle configuration, use the substitution `${var.<variable_name>}`.

For more information on custom variables and substitutions, see [\_](/dev-tools/bundles/variables.md).

### <a id="bundle-syntax-mappings-workspace"></a>workspace

The bundle configuration file can contain only one top-level `workspace` mapping to specify any non-default :re[Databricks] workspace settings to use.

:::important

Valid Databricks workspace paths begin with either `/Workspace` or for artifacts, `/Volumes`is also supported. Custom workspace paths are automatically prefixed with `/Workspace`, so if you use any workspace path substitution in your custom path such as `${workspace.file_path}`, you do not need to prepend `/Workspace` to the path.

:::

#### root_path

This `workspace` mapping can contain a `root_path` mapping to specify a non-default root path to use within the workspace for both deployments and workflow runs, for example:

```yaml
workspace:
  root_path: /Workspace/Users/${workspace.current_user.userName}/.bundle/${bundle.name}/my-envs/${bundle.target}
```

By default, for `root_path` the Databricks CLI uses the default path of `/Workspace/Users/${workspace.current_user.userName}/.bundle/${bundle.name}/${bundle.target}`, which uses [substitutions](/dev-tools/bundles/variables.md#substitutions).

#### <a id="artifact-path"></a>artifact_path

This `workspace` mapping can also contain an `artifact_path` mapping to specify a non-default artifact path to use within the workspace for both deployments and workflow runs, for example:

```yaml
workspace:
  artifact_path: /Workspace/Users/${workspace.current_user.userName}/.bundle/${bundle.name}/my-envs/${bundle.target}/artifacts
```

By default, for `artifact_path` the Databricks CLI uses the default path of `${workspace.root}/artifacts`, which uses [substitutions](/dev-tools/bundles/variables.md#substitutions).

:::note

The `artifact_path` mapping does not support Databricks File System (DBFS) paths.

:::

#### file_path

This `workspace` mapping can also contain a `file_path` mapping to specify a non-default file path to use within the workspace for both deployments and workflow runs, for example:

```yaml
workspace:
  file_path: /Workspace/Users/${workspace.current_user.userName}/.bundle/${bundle.name}/my-envs/${bundle.target}/files
```

By default, for `file_path` the Databricks CLI uses the default path of `${workspace.root}/files`, which uses [substitutions](/dev-tools/bundles/variables.md#substitutions).

#### state_path

The `state_path` mapping defaults to the default path of `${workspace.root}/state` and represents the path within your workspace to store Terraform state information about deployments.

#### Other workspace mappings

The `workspace` mapping can also contain the following optional mappings to specify the :re[Databricks] authentication mechanism to use. If they are not specified within this `workspace` mapping, they must be specified in a `workspace` mapping as a child of one or more of the targets in the top-level [targets](#bundle-syntax-mappings-targets) mapping.

:::important

You must hard-code values for the following `workspace` mappings for :re[Databricks] authentication. For instance, you cannot specify [custom variables](/dev-tools/bundles/variables.md#substitutions) for these mappings' values by using the `${var.*}` syntax.

:::

- The `profile` mapping, (or the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI) specifies the name of a configuration profile to use with this workspace for :re[Databricks] authentication. This configuration profile maps to the one that you created when you set up the Databricks CLI.

  :::note

  Databricks recommends that you use the `host` mapping (or the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI) instead of the `profile` mapping, as this makes your bundle configuration files more portable. Setting the `host` mapping instructs the Databricks CLI to find a matching profile in your `.databrickscfg` file and then use that profile's fields to determine which Databricks authentication type to use. If multiple profiles with a matching `host` field exist within your `.databrickscfg` file, then you must use the `profile` mapping (or the `--profile` or `-p` command-line options) to instruct the Databricks CLI about which profile to use. For an example, see the `prod` target declaration in the [examples](#bundle-syntax-examples).

  :::

::::aws

- The `host` mapping specifies the URL for your :re[Databricks] workspace. See [\_](/workspace/workspace-details.md#workspace-url).
- For OAuth machine-to-machine (M2M) authentication, the mapping `client_id` is used. Alternatively, you can set this value in the local environment variable `DATABRICKS_CLIENT_ID`. Or you can create a configuration profile with the `client_id` value and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI). See [\_](/dev-tools/auth/oauth-m2m.md).

  :::note

  You cannot specify a client secret value in the bundle configuration file. Instead, set the local environment variable `DATABRICKS_CLIENT_SECRET`. Or you can add the `client_secret` value to a configuration profile and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI).

  :::

::::

::::azure

- The `host` mapping specifies the URL for your :re[Databricks] workspace. See [\_](/workspace/workspace-details.md#per-workspace-url).
- For OAuth machine-to-machine (M2M) authentication, the mapping `client_id` is used. Alternatively, you can set this value in the local environment variable `DATABRICKS_CLIENT_ID`. Or you can create a configuration profile with the `client_id` value and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI). See [\_](/dev-tools/auth/oauth-m2m.md).

  :::note

  You cannot specify :re[a Databricks] OAuth secret value in the bundle configuration file. Instead, set the local environment variable `DATABRICKS_CLIENT_SECRET`. Or you can add the `client_secret` value to a configuration profile and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI).

  :::

- For Azure CLI authentication, the mapping `azure_workspace_resource_id` is used. Alternatively, you can set this value in the local environment variable `DATABRICKS_AZURE_RESOURCE_ID`. Or you can create a configuration profile with the `azure_workspace_resource_id` value and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI). See [\_](/dev-tools/auth/azure-cli.md).
- For Azure client secret authentication with service principals, the mappings `azure_workspace_resource_id`, `azure_tenant_id`, and `azure_client_id` are used. Alternatively, you can set these values in the local environment variables `DATABRICKS_AZURE_RESOURCE_ID`, `ARM_TENANT_ID`, and `ARM_CLIENT_ID`, respectively. Or you can create a configuration profile with the `azure_workspace_resource_id`, `azure_tenant_id`, and `azure_client_id` values and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI). See [\_](/dev-tools/auth/azure-sp.md).

  :::note

  You cannot specify an Azure client secret value in the bundle configuration file. Instead, set the local environment variable `ARM_CLIENT_SECRET`. Or you can add the `azure_client_secret` value to a configuration profile and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI).

  :::

- For Azure managed identities authentication, the mappings `azure_use_msi`, `azure_client_id`, and `azure_workspace_resource_id` are used. Alternatively, you can set these values in the local environment variables `ARM_USE_MSI`, `ARM_CLIENT_ID`, and `DATABRICKS_AZURE_RESOURCE_ID`, respectively. Or you can create a configuration profile with the `azure_use_msi`, `azure_client_id`, and `azure_workspace_resource_id` values and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI). See [\_](/dev-tools/auth/azure-mi.md).
- The `azure_environment` mapping specifies the Azure environment type (such as Public, UsGov, China, and Germany) for a specific set of API endpoints. The default value is `PUBLIC`. Alternatively, you can set this value in the local environment variable `ARM_ENVIRONMENT`. Or you can add the `azure_environment` value to a configuration profile and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI).
- The `azure_login_app_id` mapping is non-operational and is reserved for internal use.

::::

::::gcp

- The `host` mapping specifies the URL for your :re[Databricks] workspace. See [\_](/workspace/workspace-details.md#workspace-url).
- For OAuth machine-to-machine (M2M) authentication, use the `client_id` mapping. Alternatively, you can set this value in the local environment variable `DATABRICKS_CLIENT_ID`. Or you can create a configuration profile with the `client_id` value and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI). See [\_](/dev-tools/auth/oauth-m2m.md).

  :::note

  You can't specify :re[a Databricks] OAuth secret value in the bundle configuration file. Instead, set the local environment variable `DATABRICKS_CLIENT_SECRET`. Alternatively, you can add the `client_secret` value to a configuration profile and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI).

  :::

- For :re[GCP] service account authentication, the `google_service_account` mapping is used. Alternatively, you can set this value in the local environment variable `DATABRICKS_GOOGLE_SERVICE_ACCOUNT`. Or you can create a configuration profile with the `google_service_account` value and then specify the profile's name with the `profile` mapping (or by using the `--profile` or `-p` options when running the bundle validate, deploy, run, and destroy commands with the Databricks CLI). See [\_](/dev-tools/auth/gcp-id.md).

::::

- The `auth_type` mapping specifies the :re[Databricks] authentication type to use, especially in cases where the Databricks CLI infers an unexpected authentication type. See the [\_](/dev-tools/auth/index.md).

### <a id="bundle-syntax-mappings-permissions"></a>permissions

The top-level `permissions` mapping specifies one or more permission levels to apply to all resources defined in the bundle. If you want to apply permissions to a specific resource, see [Define permissions for a specific resource](/dev-tools/bundles/permissions.md#define-specific-resource-permissions).

Allowed top-level permission levels are `CAN_VIEW`, `CAN_MANAGE`, and `CAN_RUN`.

The following example in a bundle configuration file defines permission levels for a user, group, and service principal, which are applied to all resources defined in `resources` in the bundle:

```yaml
permissions:
  - level: CAN_VIEW
    group_name: test-group
  - level: CAN_MANAGE
    user_name: someone@example.com
  - level: CAN_RUN
    service_principal_name: 123456-abcdef
```

### <a id="bundle-syntax-mappings-resources"></a>resources

The `resources` mapping specifies information about the :re[Databricks] resources used by the bundle.

This `resources` mapping can appear as a top-level mapping, or it can be a child of one or more of the targets in the top-level [\_](#bundle-syntax-mappings-targets) mapping, and includes zero or one of the [supported resource types](/dev-tools/bundles/resources.md#resource-types). Each resource type mapping includes one or more individual resource declarations, which must each have a unique name. These individual resource declarations use the corresponding object's create operation's request payload, expressed in YAML, to define the resource. Supported properties for a resource are the corresponding object's supported fields.

Create operation request payloads are documented in the [Databricks REST API Reference](https://docs.databricks.com/api/workspace/introduction), and the `databricks bundle schema` command outputs all supported object schemas. In addition, the `databricks bundle validate` command returns warnings if unknown resource properties are found in bundle configuration files.

The following example configuration defines a job resource:

```yaml
resources:
  jobs:
    hello-job:
      name: hello-job
      tasks:
        - task_key: hello-task
          existing_cluster_id: 1234-567890-abcde123
          notebook_task:
            notebook_path: ./hello.py
```

For more information about resources supported in bundles, as well as common configuration and examples, see [\_](/dev-tools/bundles/resources.md) and [\_](/dev-tools/bundles/examples.md).

### <a id="bundle-syntax-mappings-targets"></a>targets

The `targets` mapping specifies one or more contexts in which to run :re[Databricks] workflows. Each _target_ is a unique collection of artifacts, :re[Databricks] workspace settings, and :re[Databricks] job or pipeline details.

The `targets` mapping consists of one or more target mappings, which must each have a unique programmatic (or logical) name.

This `targets` mapping is optional but highly recommended. If it is specified, it can appear only as a top-level mapping.

The settings in the top-level [\_](#bundle-syntax-mappings-workspace), [\_](#bundle-syntax-mappings-artifacts), and [\_](#bundle-syntax-mappings-resources) mappings are used if they are not specified in a `targets` mapping, but any conflicting settings are overridden by the settings within a target.

A target can also override the values of any top-level [variables](/dev-tools/bundles/variables.md#custom-variables).

#### default

To specify a target default for bundle commands, set the `default` mapping to `true`. For example, this target named `dev` is the default target:

```yaml
targets:
  dev:
    default: true
```

If a default target is not configured, or if you want to validate, deploy, and run jobs or pipelines within a specific target, use the `-t` option of the bundle commands.

The following commands validate, deploy, and run `my_job` within the `dev` and `prod` targets:

```bash
databricks bundle validate
databricks bundle deploy -t dev
databricks bundle run -t dev my_job
```

```bash
databricks bundle validate
databricks bundle deploy -t prod
databricks bundle run -t prod my_job
```

The following example declares two targets. The first target has the name `dev` and is the default target used when no target is specified for bundle commands. The second target has the name `prod` and is used only when this target is specified for bundle commands.

```yaml
targets:
  dev:
    default: true
  prod:
    workspace:
      host: https://<production-workspace-url>
```

#### mode and presets

To facilitate easy development and CI/CD best practices, :re[DABS] provides deployment modes for targets that set default behaviors for pre-production and production workflows. Some behaviors are also configurable. For details, see [\_](/dev-tools/bundles/deployment-modes.md).

:::tip

To set run identities for bundles, you can specify `run_as` for each target, as described in [\_](/dev-tools/bundles/run-as.md).

:::

To specify that a target is treated as a development target, add the `mode` mapping set to `development`. To specify that a target is treated as a production target, add the `mode` mapping set to `production`. For example, this target named `prod` is treated as a production target:

```yaml
targets:
  prod:
    mode: production
```

You can customize some of the behaviors using the `presets` mapping. For a list of available presets, see [\_](/dev-tools/bundles/deployment-modes.md#presets). The following example shows a customized production target that prefixes and tags all production resources:

```yaml
targets:
  prod:
    mode: production
    presets:
      name_prefix: 'production_' # prefix all resource names with production_
      tags:
        prod: true
```

If both `mode` and `presets` are set, presets override the default mode behavior. Settings of individual resources override the presets. For example, if a schedule is set to `UNPAUSED`, but the `trigger_pause_status` preset is set to `PAUSED`, the schedule will be unpaused.
