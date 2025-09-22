---
description: 'Learn how to work with private artifacts in :re[DABS].'
last_update:
  date: 2025-01-27
---

# Use a private artifact in a bundle

Files and artifacts stored in third party tools such as JFrog Artifactory or in private repositories may need to be part of your :re[DABS]. This article describes how to handle these files. For information about :re[DABS], see [\_](/dev-tools/bundles/index.md).

For an example bundle that uses a private wheel, see the [bundle-examples GitHub repository](https://github.com/databricks/bundle-examples/tree/main/knowledge_base/private_wheel_packages).

:::tip

If you are using notebooks, you can install Python wheels from a private repository in a notebook, then add a `notebook_task` to the job in your bundle. See [\_](/libraries/notebooks-python-libraries.md).

:::

## Download the artifact locally

To manage a private artifact using :re[DABS], you first need to download it locally. Then you can reference it in your bundle and deploy it to the workspace as part of the bundle, or you can upload it to :re[UC] and reference it in your bundle.

For example, the following command downloads a Python wheel file to the `dist` directory:

```shell
pip download -d dist my-wheel==1.0
```

You could also download a private PyPI package, then copy it to the `dist` directory.

```bash
export PYPI_TOKEN=<YOUR TOKEN>
pip download -d dist my-package==1.0.0 --index-url https://$PYPI_TOKEN@<package-index-url> --no-deps
```

### (Optional) Upload the artifact to :re[UC]

Once you have downloaded the artifact, you can optionally copy the downloaded artifact to your :re[UC] volume using the Databricks CLI, so that it can be referenced from your bundle instead of uploaded to your workspace when the bundle is deployed. The following example copies a wheel to a :re[UC] volume:

```bash
databricks fs cp my-wheel-1.0-*.whl dbfs:/Volumes/myorg_test/myorg_volumes/packages
```

:::tip

:re[DABS] will automatically upload all artifacts referenced in the bundle to :re[UC] if you set `artifact_path` in your bundle configuration to a :re[UC] volumes path.

:::

## Reference the artifact

To include the artifact in your bundle, reference it in your configuration.

The following example bundle references a wheel file in the `dist` directory in a job. This configuration uploads the wheel to the workspace when the bundle is deployed.

```yaml
resources:
  jobs:
    demo-job:
      name: demo-job
      tasks:
        - task_key: python-task
          new_cluster:
            spark_version: 13.3.x-scala2.12
            node_type_id: Standard_D4s_v5
            num_workers: 1
          spark_python_task:
            python_file: ../src/main.py
          libraries:
            - whl: ../dist/my-wheel-1.0-*.whl
```

If you uploaded your artifact to a :re[UC] volume, configure your job to reference it at that location:

```yaml
resources:
  jobs:
    demo-job:
      name: demo-job
      tasks:
        - task_key: python-task
          new_cluster:
            spark_version: 13.3.x-scala2.12
            node_type_id: Standard_D4s_v5
            num_workers: 1
          spark_python_task:
            python_file: ../src/main.py
          libraries:
            - whl: /Volumes/myorg_test/myorg_volumes/packages/my-wheel-1.0-py3-none-any.whl
```

For a Python wheel, it can alternatively be referenced in a `python_wheel_task` for a job:

```yaml
resources:
  jobs:
    demo-job:
      name: demo-job
      tasks:
        - task_key: wheel_task
          python_wheel_task:
            package_name: my_package
            entry_point: entry
          job_cluster_key: Job_cluster
          libraries:
            - whl: ../dist/my-wheel-1.0-*.whl
```
