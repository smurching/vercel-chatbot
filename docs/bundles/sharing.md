---
description: 'Learn how to share bundle files and configuration across :re[DABS], and how to configure permissions for shared bundles.'
last_update:
  date: 2025-06-27
---

# Sharing bundles and bundle files

Organizations often maintain many bundles, and in these more advanced CI/CD scenarios these bundles share common configuration and files. For example, bundles could share libraries stored in a shared location, or compute settings and variables could be defined in a configuration file in a shared location.

This article provides information about how to configure two bundles to use configuration and files in a shared folder. Complete shared bundle examples are in the [bundle-examples GitHub repository](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/share_files_across_bundles).

For additional CI/CD best practices, see [\_](/dev-tools/ci-cd/best-practices.md).

## Repository structure

A common practice for organizations with many bundles is to locate them in one repository, with a shared folder. An example repository structure with more than one bundle might be:

```
databricks-bundle-repo/
├── shared
│   ├── variables.yml           # has variable definitions like cluster_id
│   └── shared_library.py       # has shared code used in multiple bundles
├── job_bundle
│   ├── databricks.yml          # uses ${var.cluster_id} defined in variables.yml
│   ├── resources/
│   │   └── job_bundle.job.yml
│   ├── src/
│   │   ├── notebook.ipynb
│   │   └── my_python.py        # uses ../shared/shared_library.py
│   └── README.md
├── pipeline_bundle
│   ├── databricks.yml
│   ├── resources/
│   │   ├── pipeline_bundle.job.yml      # uses ${var.cluster_id} defined in variables.yml
│   │   └── pipeline_bundle.pipeline.yml
│   ├── src/
│   │   └── dlt_pipeline.ipynb
│   └── README.md
```

## Configuration for file sharing

To include code files outside of a bundle, specify them in the `paths` key of the [sync mapping](/dev-tools/bundles/settings.md#sync).

For example, given a `shared` folder in a repository (at the same level as bundle folders) that contains:

- a `shared_library.py` code file with the contents:

  ```python
  def multiply(a: int, b: int) -> int:
    return a * b
  ```

- a `variables.yml` with the contents:

  ```yaml
  variables:
    cluster_id:
      default: 1234-567890-abcde123
  ```

Then a bundle configuration that uses the shared code file and the bundle variable defined in the shared configuration would be:

```yaml
# databricks.yml

bundle:
  name: job_bundle

sync:
  paths:
    - ../shared
    - ./src

include:
  - resources/*.yml
  - ../shared/*.yml

targets:
  dev:
    mode: development
    default: true
    workspace:
      host: https://my-workspace.cloud.databricks.com

  prod:
    mode: production
    workspace:
      host: https://my-workspace.cloud.databricks.com
      root_path: /Workspace/Users/someone@example.com/.bundle/${bundle.name}/${bundle.target}
    permissions:
      - user_name: someone@example.com
        level: CAN_MANAGE
```

```yaml
# job_bundle.yml

resources:
  jobs:
    my_python_job:
      name: my_python_job
        tasks:
          - task_key: python_task
            spark_python_task:
              python_file: src/my_python.py   # uses ../shared/shared_library.py
    my_notebook_job:
      name: my_notebook_job
        tasks:
          - task_key: notebook_task
            existing_cluster_id: ${var.cluster_id}   # defined in ../shared/variables.yml
            notebook_task:
              notebook_path: src/notebook.ipynb
```

```python
# my_python.py

import os
import sys

# Traverse to the sync root path.
# Note: this requires DBR >= 14 or serverless.
shared_path = os.getcwd() + "/../../shared"

# Add the shared directory to the Python path.
sys.path.append(shared_path)

# Import a function from shared_library.py
from shared_library import multiply

# Use the function.
result = multiply(2, 3)
print(result)
```

### Bundle validation

It is important to always validate your bundle configuration, and especially so if your bundles share files and configuration. The `databricks bundle validate` command ensures that variables, files, and paths specified in your bundle exist and are properly inherited and configured, and outputs information about issues so that you can correct them before deploying. See [\_](/dev-tools/cli/bundle-commands.md#validate).

Run the following command for each bundle before deploying:

```bash
databricks bundle validate
```

## Permissions for shared bundles

Within an organization, bundles are often developed, deployed, and run by different individuals with varying responsibilities and permission levels. All users may need to be able to view the bundles, some need to be able to deploy bundle changes and run resources in the target development workspace, a select few need to be able to deploy bundle changes and run resources in production, and automated workflows that use a service principal need to be able to run resources in a bundle. To ensure your shared bundles can be managed effectively by all users in your organization, set top-level permissions as well as production target permissions. For information about top-level permissions, which apply permissions to all resources in a bundle, see [\_](/dev-tools/bundles/settings.md#permissions).

:::tip

:re[DABS] in the workspace enables easy collaboration on bundles. See [\_](/dev-tools/bundles/workspace.md).

:::

For example, the `databricks.yml` for a shared bundle might be:

```yaml
# databricks.yml

bundle:
  name: shared_bundle

include:
  - resources/*.yml

permissions:
  - level: CAN_VIEW
    group_name: all_users
  - level: CAN_MANAGE
    group_name: data_engineering_users
  - level: CAN_RUN
    service_principal_name: 123456-abcdef

targets:
  dev:
    mode: development
    default: true
    workspace:
      host: https://my-workspace.cloud.databricks.com

  prod:
    mode: production
    workspace:
      host: https://my-workspace.cloud.databricks.com
      root_path: /Workspace/Users/someone@example.com/.bundle/${bundle.name}/${bundle.target}
    permissions:
      - user_name: someone@example.com
        level: CAN_MANAGE
```
