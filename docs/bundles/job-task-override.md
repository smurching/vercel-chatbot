---
description: 'Learn how to override the settings for job tasks in :re[DABS]. Bundles enable programmatic management of jobs in Databricks.'
last_update:
  date: 2024-04-22
---

# Override job tasks settings in :re[DABS]

This article describes how to override the settings for :re[Databricks] job tasks in :re[DABS]. See [\_](/dev-tools/bundles/index.md).

In :re[Databricks] [bundle configuration files](/dev-tools/bundles/settings.md), you can use the `task` mapping within a job definition to join the job tasks settings in a top-level `resources` mapping with the job task settings in a `targets` mapping, for example (ellipses indicate omitted content, for brevity):

```yaml
# ...
resources:
  jobs:
    <some-unique-programmatic-identifier-for-this-job>:
      # ...
      tasks:
        - task_key: <some-unique-programmatic-identifier-for-this-task>
          # Task settings.

targets:
  <some-unique-programmatic-identifier-for-this-target>:
    resources:
      jobs:
        <the-matching-programmatic-identifier-for-this-job>:
          # ...
          tasks:
            - task_key: <the-matching-programmatic-identifier-for-this-key>
              # Any more task settings to join with the settings from the
              # resources mapping for the matching top-level task_key.
          # ...
```

To join the top-level `resources` mapping and the `targets` mapping for the same `task`, the `task` mappings' `task_key` must be set to the same value.

If any job task setting is defined both in the top-level `resources` mapping and the `targets` mapping for the same `task`, then the setting in the `targets` mapping takes precedence over the setting in the top-level `resources` mapping.

## Example 1: Job task settings defined in multiple resource mappings and with no settings conflicts

In this example, `spark_version` in the top-level `resources` mapping is combined with `node_type_id` and `num_workers` in the `resources` mapping in `targets` to define the settings for the `task_key` named `my-task` (ellipses indicate omitted content, for brevity):

:::aws

```yaml
# ...
resources:
  jobs:
    my-job:
      name: my-job
      tasks:
        - task_key: my-task
          new_cluster:
            spark_version: 13.3.x-scala2.12

targets:
  development:
    resources:
      jobs:
        my-job:
          name: my-job
          tasks:
            - task_key: my-task
              new_cluster:
                node_type_id: i3.xlarge
                num_workers: 1
          # ...
```

:::

:::azure

```yaml
# ...
resources:
  jobs:
    my-job:
      name: my-job
      tasks:
        - task_key: my-key
          new_cluster:
            spark_version: 13.3.x-scala2.12

targets:
  development:
    resources:
      jobs:
        my-job:
          name: my-job
          tasks:
            - task_key: my-task
              new_cluster:
                node_type_id: Standard_DS3_v2
                num_workers: 1
          # ...
```

:::

:::gcp

```yaml
# ...
resources:
  jobs:
    my-job:
      name: my-job
      tasks:
        - task_key: my-key
          new_cluster:
            spark_version: 13.3.x-scala2.12

targets:
  development:
    resources:
      jobs:
        my-job:
          name: my-job
          tasks:
            - task_key: my-task
              new_cluster:
                node_type_id: n2-highmem-4
                num_workers: 1
          # ...
```

:::

When you run `databricks bundle validate` for this example, the resulting graph is as follows (ellipses indicate omitted content, for brevity):

:::aws

```json
{
  "...": "...",
  "resources": {
    "jobs": {
      "my-job": {
        "tasks": [
          {
            "new_cluster": {
              "node_type_id": "i3.xlarge",
              "num_workers": 1,
              "spark_version": "13.3.x-scala2.12"
            },
            "task-key": "my-task"
          }
        ],
        "...": "..."
      }
    }
  }
}
```

:::

:::azure

```json
{
  "...": "...",
  "resources": {
    "jobs": {
      "my-job": {
        "tasks": [
          {
            "new_cluster": {
              "node_type_id": "Standard_DS3_v2",
              "num_workers": 1,
              "spark_version": "13.3.x-scala2.12"
            },
            "task-key": "my-task"
          }
        ],
        "...": "..."
      }
    }
  }
}
```

:::

:::gcp

```json
{
  "...": "...",
  "resources": {
    "jobs": {
      "my-job": {
        "tasks": [
          {
            "new_cluster": {
              "node_type_id": "n2-highmem-4",
              "num_workers": 1,
              "spark_version": "13.3.x-scala2.12"
            },
            "task-key": "my-task"
          }
        ],
        "...": "..."
      }
    }
  }
}
```

:::

## Example 2: Conflicting job task settings defined in multiple resource mappings

In this example, `spark_version`, and `num_workers` are defined both in the top-level `resources` mapping and in the `resources` mapping in `targets`. `spark_version` and `num_workers` in the `resources` mapping in `targets` take precedence over `spark_version` and `num_workers` in the top-level `resources` mapping. This defines the settings for the `task_key` named `my-task` (ellipses indicate omitted content, for brevity):

:::aws

```yaml
# ...
resources:
  jobs:
    my-job:
      name: my-job
      tasks:
        - task_key: my-task
          new_cluster:
            spark_version: 13.3.x-scala2.12
            node_type_id: i3.xlarge
            num_workers: 1

targets:
  development:
    resources:
      jobs:
        my-job:
          name: my-job
          tasks:
            - task_key: my-task
              new_cluster:
                spark_version: 12.2.x-scala2.12
                num_workers: 2
          # ...
```

:::

:::azure

```yaml
# ...
resources:
  jobs:
    my-job:
      name: my-job
      tasks:
        - task_key: my-task
          new_cluster:
            spark_version: 13.3.x-scala2.12
            node_type_id: Standard_DS3_v2
            num_workers: 1

targets:
  development:
    resources:
      jobs:
        my-job:
          name: my-job
          tasks:
            - task_key: my-task
              new_cluster:
                spark_version: 12.2.x-scala2.12
                num_workers: 2
          # ...
```

:::

:::gcp

```yaml
# ...
resources:
  jobs:
    my-job:
      name: my-job
      tasks:
        - task_key: my-task
          new_cluster:
            spark_version: 13.3.x-scala2.12
            node_type_id: n2-highmem-4
            num_workers: 1

targets:
  development:
    resources:
      jobs:
        my-job:
          name: my-job
          tasks:
            - task_key: my-task
              new_cluster:
                spark_version: 12.2.x-scala2.12
                num_workers: 2
          # ...
```

:::

When you run `databricks bundle validate` for this example, the resulting graph is as follows (ellipses indicate omitted content, for brevity):

:::aws

```json
{
  "...": "...",
  "resources": {
    "jobs": {
      "my-job": {
        "tasks": [
          {
            "new_cluster": {
              "node_type_id": "i3.xlarge",
              "num_workers": 2,
              "spark_version": "12.2.x-scala2.12"
            },
            "task_key": "my-task"
          }
        ],
        "...": "..."
      }
    }
  }
}
```

:::

:::azure

```json
{
  "...": "...",
  "resources": {
    "jobs": {
      "my-job": {
        "tasks": [
          {
            "new_cluster": {
              "node_type_id": "Standard_DS3_v2",
              "num_workers": 2,
              "spark_version": "12.2.x-scala2.12"
            },
            "task_key": "my-task"
          }
        ],
        "...": "..."
      }
    }
  }
}
```

:::

:::gcp

```json
{
  "...": "...",
  "resources": {
    "jobs": {
      "my-job": {
        "tasks": [
          {
            "new_cluster": {
              "node_type_id": "n2-highmem-4",
              "num_workers": 2,
              "spark_version": "12.2.x-scala2.12"
            },
            "task_key": "my-task"
          }
        ],
        "...": "..."
      }
    }
  }
}
```

:::
