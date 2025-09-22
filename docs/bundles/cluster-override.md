---
description: 'Learn how to override the settings for clusters in :re[DABS].'
last_update:
  date: 2025-03-21
---

# Override cluster settings in :re[DABS]

This article describes how to override the settings for :re[Databricks] clusters in :re[DABS]. See [\_](/dev-tools/bundles/index.md).

In :re[Databricks] [bundle configuration files](/dev-tools/bundles/settings.md), you can join the cluster settings in a top-level `resources` mapping with the cluster settings in a `targets` mapping, as follows.

For jobs, use `job_cluster_key` within a job definition to identify job cluster settings in the top-level `resources` mapping to join with job cluster settings in a `targets` mapping:

```yaml
# ...
resources:
  jobs:
    <some-unique-programmatic-identifier-for-this-job>:
      # ...
      job_clusters:
        - job_cluster_key: <some-unique-programmatic-identifier-for-this-key>
          new_cluster:
            # Cluster settings.

targets:
  <some-unique-programmatic-identifier-for-this-target>:
    resources:
      jobs:
        <the-matching-programmatic-identifier-for-this-job>:
          # ...
          job_clusters:
            - job_cluster_key: <the-matching-programmatic-identifier-for-this-key>
              # Any more cluster settings to join with the settings from the
              # resources mapping for the matching top-level job_cluster_key.
          # ...
```

If any cluster setting is defined both in the top-level `resources` mapping and the `targets` mapping for the same `job_cluster_key`, then the setting in the `targets` mapping takes precedence over the setting in the top-level `resources` mapping.

For :re[LDP], use `label` within the cluster settings of a pipeline definition to identify cluster settings in a top-level `resources` mapping to join with the cluster settings in a `targets` mapping, for example:

```yaml
# ...
resources:
  pipelines:
    <some-unique-programmatic-identifier-for-this-pipeline>:
      # ...
      clusters:
        - label: default | maintenance
          # Cluster settings.

targets:
  <some-unique-programmatic-identifier-for-this-target>:
    resources:
      pipelines:
        <the-matching-programmatic-identifier-for-this-pipeline>:
          # ...
          clusters:
            - label: default | maintenance
              # Any more cluster settings to join with the settings from the
              # resources mapping for the matching top-level label.
          # ...
```

If any cluster setting is defined both in the top-level `resources` mapping and the `targets` mapping for the same `label`, then the setting in the `targets` mapping takes precedence over the setting in the top-level `resources` mapping.

## Example 1: New job cluster settings defined in multiple resource mappings and with no settings conflicts

In this example, `spark_version` in the top-level `resources` mapping is combined with `node_type_id` and `num_workers` in the `resources` mapping in `targets` to define the settings for the `job_cluster_key` named `my-cluster`:

:::aws

```yaml
# ...
resources:
  jobs:
    my-job:
      name: my-job
      job_clusters:
        - job_cluster_key: my-cluster
          new_cluster:
            spark_version: 13.3.x-scala2.12

targets:
  development:
    resources:
      jobs:
        my-job:
          name: my-job
          job_clusters:
            - job_cluster_key: my-cluster
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
      job_clusters:
        - job_cluster_key: my-cluster
          new_cluster:
            spark_version: 13.3.x-scala2.12

targets:
  development:
    resources:
      jobs:
        my-job:
          name: my-job
          job_clusters:
            - job_cluster_key: my-cluster
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
      job_clusters:
        - job_cluster_key: my-cluster
          new_cluster:
            spark_version: 13.3.x-scala2.12

targets:
  development:
    resources:
      jobs:
        my-job:
          name: my-job
          job_clusters:
            - job_cluster_key: my-cluster
              new_cluster:
                node_type_id: n2-highmem-4
                num_workers: 1
          # ...
```

:::

When you run `databricks bundle validate` for this example, the resulting graph is as follows:

:::aws

```json
{
  "...": "...",
  "resources": {
    "jobs": {
      "my-job": {
        "job_clusters": [
          {
            "job_cluster_key": "my-cluster",
            "new_cluster": {
              "node_type_id": "i3.xlarge",
              "num_workers": 1,
              "spark_version": "13.3.x-scala2.12"
            }
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
        "job_clusters": [
          {
            "job_cluster_key": "my-cluster",
            "new_cluster": {
              "node_type_id": "Standard_DS3_v2",
              "num_workers": 1,
              "spark_version": "13.3.x-scala2.12"
            }
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
        "job_clusters": [
          {
            "job_cluster_key": "my-cluster",
            "new_cluster": {
              "node_type_id": "n2-highmem-4",
              "num_workers": 1,
              "spark_version": "13.3.x-scala2.12"
            }
          }
        ],
        "...": "..."
      }
    }
  }
}
```

:::

## Example 2: Conflicting new job cluster settings defined in multiple resource mappings

In this example, `spark_version`, and `num_workers` are defined both in the top-level `resources` mapping and in the `resources` mapping in `targets`. In this example, `spark_version` and `num_workers` in the `resources` mapping in `targets` take precedence over `spark_version` and `num_workers` in the top-level `resources` mapping, to define the settings for the `job_cluster_key` named `my-cluster`:

:::aws

```yaml
# ...
resources:
  jobs:
    my-job:
      name: my-job
      job_clusters:
        - job_cluster_key: my-cluster
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
          job_clusters:
            - job_cluster_key: my-cluster
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
      job_clusters:
        - job_cluster_key: my-cluster
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
          job_clusters:
            - job_cluster_key: my-cluster
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
      job_clusters:
        - job_cluster_key: my-cluster
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
          job_clusters:
            - job_cluster_key: my-cluster
              new_cluster:
                spark_version: 12.2.x-scala2.12
                num_workers: 2
          # ...
```

:::

When you run `databricks bundle validate` for this example, the resulting graph is as follows:

:::aws

```json
{
  "...": "...",
  "resources": {
    "jobs": {
      "my-job": {
        "job_clusters": [
          {
            "job_cluster_key": "my-cluster",
            "new_cluster": {
              "node_type_id": "i3.xlarge",
              "num_workers": 2,
              "spark_version": "12.2.x-scala2.12"
            }
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
        "job_clusters": [
          {
            "job_cluster_key": "my-cluster",
            "new_cluster": {
              "node_type_id": "Standard_DS3_v2",
              "num_workers": 2,
              "spark_version": "12.2.x-scala2.12"
            }
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
        "job_clusters": [
          {
            "job_cluster_key": "my-cluster",
            "new_cluster": {
              "node_type_id": "n2-highmem-4",
              "num_workers": 2,
              "spark_version": "12.2.x-scala2.12"
            }
          }
        ],
        "...": "..."
      }
    }
  }
}
```

:::

## Example 3: Pipeline cluster settings defined in multiple resource mappings and with no settings conflicts

In this example, `node_type_id` in the top-level `resources` mapping is combined with `num_workers` in the `resources` mapping in `targets` to define the settings for the `label` named `default`:

:::aws

```yaml
# ...
resources:
  pipelines:
    my-pipeline:
      clusters:
        - label: default
          node_type_id: i3.xlarge

targets:
  development:
    resources:
      pipelines:
        my-pipeline:
          clusters:
            - label: default
              num_workers: 1
          # ...
```

:::

:::azure

```yaml
# ...
resources:
  pipelines:
    my-pipeline:
      clusters:
        - label: default
          node_type_id: Standard_DS3_v2

targets:
  development:
    resources:
      pipelines:
        my-pipeline:
          clusters:
            - label: default
              num_workers: 1
          # ...
```

:::

:::gcp

```yaml
# ...
resources:
  pipelines:
    my-pipeline:
      clusters:
        - label: default
          node_type_id: n2-highmem-4

targets:
  development:
    resources:
      pipelines:
        my-pipeline:
          clusters:
            - label: default
              num_workers: 1
          # ...
```

:::

When you run `databricks bundle validate` for this example, the resulting graph is as follows:

:::aws

```json
{
  "...": "...",
  "resources": {
    "pipelines": {
      "my-pipeline": {
        "clusters": [
          {
            "label": "default",
            "node_type_id": "i3.xlarge",
            "num_workers": 1
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
    "pipelines": {
      "my-pipeline": {
        "clusters": [
          {
            "label": "default",
            "node_type_id": "Standard_DS3_v2",
            "num_workers": 1
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
    "pipelines": {
      "my-pipeline": {
        "clusters": [
          {
            "label": "default",
            "node_type_id": "n2-highmem-4",
            "num_workers": 1
          }
        ],
        "...": "..."
      }
    }
  }
}
```

:::

## Example 4: Conflicting pipeline cluster settings defined in multiple resource mappings

In this example, `num_workers` is defined both in the top-level `resources` mapping and in the `resources` mapping in `targets`. `num_workers` in the `resources` mapping in `targets` take precedence over `num_workers` in the top-level `resources` mapping, to define the settings for the `label` named `default`:

:::aws

```yaml
# ...
resources:
  pipelines:
    my-pipeline:
      clusters:
        - label: default
          node_type_id: i3.xlarge
          num_workers: 1

targets:
  development:
    resources:
      pipelines:
        my-pipeline:
          clusters:
            - label: default
              num_workers: 2
          # ...
```

:::

:::azure

```yaml
# ...
resources:
  pipelines:
    my-pipeline:
      clusters:
        - label: default
          node_type_id: Standard_DS3_v2
          num_workers: 1

targets:
  development:
    resources:
      pipelines:
        my-pipeline:
          clusters:
            - label: default
              num_workers: 2
          # ...
```

:::

:::gcp

```yaml
# ...
resources:
  pipelines:
    my-pipeline:
      clusters:
        - label: default
          node_type_id: n2-highmem-4
          num_workers: 1

targets:
  development:
    resources:
      pipelines:
        my-pipeline:
          clusters:
            - label: default
              num_workers: 2
          # ...
```

:::

When you run `databricks bundle validate` for this example, the resulting graph is as follows:

:::aws

```json
{
  "...": "...",
  "resources": {
    "pipelines": {
      "my-pipeline": {
        "clusters": [
          {
            "label": "default",
            "node_type_id": "i3.xlarge",
            "num_workers": 2
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
    "pipelines": {
      "my-pipeline": {
        "clusters": [
          {
            "label": "default",
            "node_type_id": "Standard_DS3_v2",
            "num_workers": 2
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
    "pipelines": {
      "my-pipeline": {
        "clusters": [
          {
            "label": "default",
            "node_type_id": "n2-highmem-4",
            "num_workers": 2
          }
        ],
        "...": "..."
      }
    }
  }
}
```

:::
