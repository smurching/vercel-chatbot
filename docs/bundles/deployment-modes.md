---
description: 'Learn about the syntax and behaviors for declaring and using deployment modes for :re[DABS]. Bundles enable programmatic management of Databricks workflows.'
last_update:
  date: 2025-06-18
---

# Databricks Asset Bundle deployment modes

This article describes the syntax for _Databricks Asset Bundle_ deployment modes. Bundles enable programmatic management of :re[Databricks] workflows. See [\_](/dev-tools/bundles/index.md)

In CI/CD workflows, developers typically code, test, deploy, and run solutions in various phases, or _modes_. For example, the simplest set of modes includes a _development_ mode for pre-production validation, followed by a _production_ mode for validated deliverables. :re[DABS] provides an optional collection of default behaviors that correspond to each of these modes. To use these behaviors for a specific target, set a `mode` or configure `presets` for a target in the `targets` configuration mapping. For information on `targets`, see [bundle configuration targets mapping](/dev-tools/bundles/settings.md#targets).

## <a id="development-mode"></a>Development mode

To deploy your bundle in development mode, you must first add the `mode` mapping, set to `development`, to the intended target. For example, this target named `dev` is treated as a development target:

```yaml
targets:
  dev:
    mode: development
```

Deploying a target in development mode by running the `databricks bundle deploy -t <target-name>` command implements the following behaviors, which can be customized using [presets](#presets):

- Prepends all resources that are not deployed as files or notebooks with the prefix `[dev ${workspace.current_user.short_name}]` and tags each deployed job and pipeline with a `dev` :re[Databricks] tag.
- Marks all related deployed :re[LDP] as `development: true`.
- Enables the use of `--compute-id <cluster-id>` in related calls to the `bundle deploy` command, which overrides any and all existing cluster definitions that are already specified in the related bundle configuration file. Instead of using `--compute-id <cluster-id>` in related calls to the `bundle deploy` command, you can set the `compute_id` mapping here, or as a child mapping of the `bundle` mapping, to the ID of the cluster to use.
- Pauses all schedules and triggers on deployed resources such as jobs or quality monitors. Unpause schedules and triggers for an individual job by setting `schedule.pause_status` to `UNPAUSED`.
- Enables concurrent runs on all deployed jobs for faster iteration. Disable concurrent runs for an individual job by setting `max_concurrent_runs` to `1`.
- Disables the deployment lock for faster iteration. This lock prevents deployment conflicts which are unlikely to occur in dev mode. Re-enable the lock by setting `bundle.deployment.lock.enabled` to `true`.

## <a id="production-mode"></a>Production mode

To deploy your bundle in production mode, you must first add the `mode` mapping, set to `production`, to the intended target. For example, this target named `prod` is treated as a production target:

```yaml
targets:
  prod:
    mode: production
```

Deploying a target in production mode by running the `databricks bundle deploy -t <target-name>` command implements the following behaviors:

- Validates that all related deployed :re[LDP] are marked as `development: false`.
- Validates that the current Git branch is equal to the Git branch that is specified in the target. Specifying a Git branch in the target is optional and can be done with an additional `git` property as follows:

  ```yaml
  git:
    branch: main
  ```

  This validation can be overridden by specifying `--force` while deploying.

- Databricks recommends that you use service principals for production deployments. You can enforce this by setting `run_as` to a service principal. See [\_](/admin/users-groups/service-principals.md) and [\_](/dev-tools/bundles/run-as.md). If you do not use service principals, then note the following additional behaviors:
  - Validates that `artifact_path`, `file_path`, `root_path`, or `state_path` mappings are not overridden to a specific user.
  - Validates that the `run_as` and `permissions` mappings are specified to clarify which identities have specific permissions for deployments.
- Unlike the preceding behavior for setting the `mode` mapping to `development`, setting the `mode` mapping to `production` does not allow overriding any existing cluster definitions that are specified in the related bundle configuration file, for instance by using the `--compute-id <cluster-id>` option or the `compute_id` mapping.

## <a id="presets"></a>Custom presets

:re[DABS] supports configurable presets for [targets](/dev-tools/bundles/settings.md#targets), which allows you to customize the behaviors for targets. The available presets are listed in the following table:

:::note

Unless an exception is specified in the table below, if both `mode` and `presets` are set, presets override the default mode behavior, and settings of individual resources override the presets. For example, if the `max_concurrent_runs` for a job is 10, but the `jobs_max_concurrent_runs` preset is set to 20, the job's maximum concurrent runs will be 10.

:::

:::list-table

- - Preset
  - Description
- - `artifacts_dynamic_version`
  - Whether or not to dynamically update the version of `whl` artifacts during deployment. Valid values are `true` or `false`. If the top-level [artifacts.dynamic_version configuration setting](/dev-tools/bundles/settings.md#bundle-syntax-mappings-artifacts) is specified, it overrides this preset.
- - `jobs_max_concurrent_runs`
  - The number of maximum allowed concurrent runs for jobs.
- - `name_prefix`
  - The prefix string to prepend to resource names.
- - `pipelines_development`
  - Whether or not the pipeline is in development mode. Valid values are `true` or `false`.
- - `source_linked_deployment`
  - Reserved for future use. Whether or not resources created during deployment point to source files in the workspace instead of their workspace copies.
- - `tags`
  - A set of key:value tags that apply to all resources that support tags, which includes jobs and experiments. :re[DABS] do not support tags for the `schema` resource.
- - `trigger_pause_status`
  - A pause status to apply to all triggers and schedules. Valid values are `PAUSED` or `UNPAUSED`.

    If `mode` is set to `development`, `trigger_pause_status` is always `PAUSED`.

:::

The following example shows a custom presets configuration for the target named `dev`:

```yaml
targets:
  dev:
    presets:
      name_prefix: 'testing_' # prefix all resource names with testing_
      pipelines_development: true # set development to true for pipelines
      trigger_pause_status: PAUSED # set pause_status to PAUSED for all triggers and schedules
      jobs_max_concurrent_runs: 10 # set max_concurrent runs to 10 for all jobs
      tags:
        department: finance
```
