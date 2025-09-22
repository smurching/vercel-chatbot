---
description: 'Learn how to set permissions for resources in :re[DABS].'
last_update:
  date: 2025-08-19
---

# Set permissions for resources in :re[DABS]

This article describes how to set permissions for resources in :re[DABS]. For information about resources supported in bundles, see [\_](/dev-tools/bundles/resources.md).

In :re[Databricks] [bundle configuration files](/dev-tools/bundles/settings.md), you can define permissions at the top level to apply to all resources defined in the bundle, or you can define permissions to apply to specific resources.

:::note

Permissions cannot overlap. In other words, permissions for a user, group, or service principal cannot be defined in both the top-level `permissions` mapping and within the `resources` mapping.

:::

## <a id="define-toplevel-resource-permissions"></a>Define permissions to apply to all resources

You can define permissions to apply to all supported resources defined in `resources` using the top-level `permissions` mapping. Databricks recommends this approach for managing :re[DABS] resource permissions.

Permissions define the allowed permissions level for a `user_name`, `group_name`, or `service_principal_name`. Allowed top-level permission levels are `CAN_VIEW`, `CAN_MANAGE`, and `CAN_RUN`. For more information about the top-level `permissions` mapping, see [\_](/dev-tools/bundles/settings.md#bundle-syntax-mappings-permissions).

The following example sets top-level permissions for the `dev` target. The user `someone@example.com` will have `CAN_RUN` permissions on `my-job`:

```yaml
bundle:
  name: my-bundle

resources:
  jobs:
    my-job:
      # ...

targets:
  dev:
    # ...
    permissions:
      - user_name: someone@example.com
        level: CAN_RUN
```

## <a id="define-specific-resource-permissions"></a>Define permissions for a specific resource

You can use the `permissions` mapping in a dashboard, experiment, job, model, or pipeline definition in `resources` to define one or more permissions for that resource.

Each permission in the `permissions` mapping must include the following:

- Either `user_name`, `group_name`, or `service_principal_name`, set to the name of the user, group, or service principal, respectively.
- `level`, set to the name of the permission level. Allowed permission levels for each resource are the following:
  - [Dashboards](/security/auth/access-control/index.md#lakeview): `CAN_EDIT`, `CAN_MANAGE` `CAN_VIEW`, and `CAN_READ`.
  - [Experiments](/security/auth/access-control/index.md#experiments): `CAN_EDIT`, `CAN_MANAGE` and `CAN_READ`.
  - [Jobs](/security/auth/access-control/index.md#jobs): `CAN_MANAGE`, `CAN_MANAGE_RUN`, `CAN_VIEW`, and `IS_OWNER`.
  - [Models](/security/auth/access-control/index.md#models): `CAN_EDIT`, `CAN_MANAGE`, `CAN_MANAGE_STAGING_VERSIONS`, `CAN_MANAGE_PRODUCTION_VERSIONS`, and `CAN_READ`.
  - [Pipelines](/security/auth/access-control/index.md#dlt): `CAN_MANAGE`, `CAN_RUN`, `CAN_VIEW`, and `IS_OWNER`.

:::important

Allowed permission levels for resources cannot necessarily be applied to resources using the top-level `permissions` mapping. For valid permission levels for the top-level `permissions` mapping, see [\_](/dev-tools/bundles/settings.md#bundle-syntax-mappings-permissions).

:::

The following syntax shows how to declare permissions for a resource type (in this example, pipelines) in the top-level `resources` mapping and in a `resources` mapping within a target:

```yaml
# ...
resources:
  pipelines:
    <some-programmatic-identifier-for-this-pipeline>:
      # ...
      permissions:
        - user_name: <user-name> # Or:
          group_name: <group-name-1> # Or:
          service_principal_name: <service-principal-name>
          level: <permission-level>
      # ...
```

```yaml
targets:
  <some-programmatic-identifier-for-this-target>:
    resources:
      pipelines:
        <some-programmatic-identifier-for-this-pipeline>:
          # ...
          permissions:
            - user_name: <user-name> # Or:
              group_name: <group-name> # Or:
              service_principal_name: <service-principal-name>
              level: <permission-level>
          # ...
    # ...
```

Any permissions that are declared for a resource in the top-level `resources` mapping are combined with any permissions that are declared for that same `resources` mapping in an individual target. For example, given the following `resources` mapping for the same resource at both the top level and in a target:

```yaml
bundle:
  name: my-bundle

resources:
  jobs:
    my-job:
      # ...
      permissions:
        - group_name: test-group
          level: CAN_VIEW
      # ...

targets:
  dev:
    # ...
    resources:
      jobs:
        my-job:
          # ...
          permissions:
            - user_name: someone@example.com
              level: CAN_MANAGE_RUN
          # ...
```

When you run `databricks bundle validate` for this example, the resulting graph is as follows:

```json
{
  "...": "...",
  "resources": {
    "jobs": {
      "my-job": {
        "permissions": [
          {
            "level": "CAN_VIEW",
            "group_name": "test-group"
          },
          {
            "level": "CAN_MANAGE_RUN",
            "user_name": "someone@example.com"
          }
        ],
        "...": "..."
      }
    }
  }
}
```

## Permissions order of precedence

If you have `permissions` defined in multiple places in your bundle configuration, the permissions granted to resources, workspace directories, and files specified in the bundle are in the following order:

1. The [permissions defined for the resource in the target deployment](/dev-tools/bundles/reference.md#targetsnameresources)
1. The [permissions defined for the target deployment](/dev-tools/bundles/reference.md#targetsnamepermissions)
1. The [permissions defined for the resource in the bundle](#define-specific-resource-permissions)
1. The [permissions defined in the bundle's top-level permissions](#define-toplevel-resource-permissions)

For example, in the following configuration, the group `test-group` will have `CAN_MANAGE` permissions for the job in the `dev` target, but `CAN_MANAGE_RUN` permissions for the job in the `prod` target:

```yaml
bundle:
  name: my-bundle

permissions:
  - group_name: test-group
    level: CAN_VIEW

resources:
  jobs:
    my-job:
      # ...
      permissions:
        - group_name: test-group
          level: CAN_MANAGE_RUN
      # ...

targets:
  dev:
    # ...
    resources:
      jobs:
        my-job:
          # ...
          permissions:
            - group_name: test-group
              level: CAN_MANAGE
          # ...
  prod:
    # ...
    resources:
      jobs:
        my-job:
          # ...
```
