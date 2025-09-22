---
description: 'Learn how to define the settings for dynamic artifact builds in :re[DABS].'
last_update:
  date: 2024-12-03
---

# Define artifact settings in :re[DABS]

This article describes how to override the settings for artifacts in :re[DABS]. See [\_](/dev-tools/bundles/index.md)

In :re[Databricks] [bundle configuration files](/dev-tools/bundles/settings.md), you can override the artifact settings in a top-level `artifacts` mapping with the artifact settings in a `targets` mapping, for example:

```yaml
# ...
artifacts:
  <some-unique-programmatic-identifier-for-this-artifact>:
    # Artifact settings.

targets:
  <some-unique-programmatic-identifier-for-this-target>:
    artifacts:
      <the-matching-programmatic-identifier-for-this-artifact>:
        # Any more artifact settings to join with the settings from the
        # matching top-level artifacts mapping.
```

If any artifact setting is defined both in the top-level `artifacts` mapping and the `targets` mapping for the same artifact, then the setting in the `targets` mapping takes precedence over the setting in the top-level `artifacts` mapping.

## Example 1: Artifact settings defined only in the top-level artifacts mapping

To demonstrate how this works in practice, in the following example, `path` is defined in the top-level `artifacts` mapping, which defines all of the settings for the artifact (ellipses indicate omitted content, for brevity):

```yaml
# ...
artifacts:
  my-artifact:
    type: whl
    path: ./my_package
# ...
```

When you run `databricks bundle validate` for this example, the resulting graph is:

```json
{
  "...": "...",
  "artifacts": {
    "my-artifact": {
      "type": "whl",
      "path": "./my_package",
      "...": "..."
    }
  },
  "...": "..."
}
```

## Example 2: Conflicting artifact settings defined in multiple artifact mappings

In this example, `path` is defined both in the top-level `artifacts` mapping and in the `artifacts` mapping in `targets`. In this example, `path` in the `artifacts` mapping in `targets` takes precedence over `path` in the top-level `artifacts` mapping, to define the settings for the artifact (ellipses indicate omitted content, for brevity):

```yaml
# ...
artifacts:
  my-artifact:
    type: whl
    path: ./my_package

targets:
  dev:
    artifacts:
      my-artifact:
        path: ./my_other_package
    # ...
```

When you run `databricks bundle validate` for this example, the resulting graph is (ellipses indicate omitted content, for brevity):

```json
{
  "...": "...",
  "artifacts": {
    "my-artifact": {
      "type": "whl",
      "path": "./my_other_package",
      "...": "..."
    }
  },
  "...": "..."
}
```
