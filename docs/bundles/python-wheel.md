---
description: 'Learn how to build and deploy Python wheel files in :re[DABS].'
last_update:
  date: 2025-08-04
---

# Build a Python wheel file using :re[DABS]

This article describes how to build, deploy, and run a Python wheel file as part of a _Databricks Asset Bundle_ project. See [\_](/dev-tools/bundles/index.md).

For an example configuration that builds a JAR and uploads it to :re[UC], see [\_](/dev-tools/bundles/examples.md#jar-upload).

## Requirements

- Databricks CLI version 0.218.0 or above is installed, and authentication is configured. To check your installed version of the Databricks CLI, run the command `databricks -v`. To install the Databricks CLI, see [\_](/dev-tools/cli/install.md). To configure authentication, see [\_](/dev-tools/cli/tutorial.md#auth).
- The remote workspace must have workspace files enabled. See [\_](/files/workspace.md).

## <a id="template"></a>Create the bundle using a template

In these steps, you create the bundle using the :re[Databricks] default bundle template for Python. This bundle consists of files to build into a Python wheel file and the definition of :re[a Databricks] job to build this Python wheel file. You then validate, deploy, and build the deployed files into a Python wheel file from the Python wheel job within your :re[Databricks] workspace.

:::note

The :re[Databricks] default bundle template for Python uses [uv](https://pypi.org/project/uv/) to build the Python wheel file. To install `uv`, see [Installing uv](https://docs.astral.sh/uv/getting-started/installation/).

:::

If you want to create a bundle from scratch, see [\_](/dev-tools/bundles/manual-bundle.md).

### <a id="create-bundle"></a>Step 1: Create the bundle

A bundle contains the artifacts you want to deploy and the settings for the workflows you want to run.

1. Use your terminal or command prompt to switch to a directory on your local development machine that will contain the template's generated bundle.
1. Use the Databricks CLI version to run the `bundle init` command:

   ```bash
   databricks bundle init
   ```

1. For `Template to use`, leave the default value of `default-python` by pressing `Enter`.
1. For `Unique name for this project`, leave the default value of `my_project`, or type a different value, and then press `Enter`. This determines the name of the root directory for this bundle. This root directory is created within your current working directory.
1. For `Include a stub (sample) notebook`, select `no` and press `Enter`. This instructs the Databricks CLI to not add a sample notebook to your bundle.
1. For `Include a stub (sample) Delta Live Tables pipeline`, select `no` and press `Enter`. This instructs the Databricks CLI to not define a sample pipeline in your bundle.
1. For `Include a stub (sample) Python package`, leave the default value of `yes` by pressing `Enter`. This instructs the Databricks CLI to add sample Python wheel package files and related build instructions to your bundle.
1. For `Use serverless`, select `yes` and press `Enter`. This instructs the Databricks CLI to configure your bundle to run on serverless compute.

### Step 2: Explore the bundle

To view the files that the template generated, switch to the root directory of your newly created bundle and open this directory with your preferred IDE. Files of particular interest include the following:

- `databricks.yml`: This file specifies the bundle's name, specifies `whl` build settings, includes a reference to the job configuration file, and defines settings for target workspaces.
- `resources/<project-name>_job.yml`: This file specifies the Python wheel job's settings.
- `src/<project-name>`: This directory includes the files that the Python wheel job uses to build the Python wheel file.

:::note

If you want to install the Python wheel file on a cluster with :re[DBR] 12.2 LTS or below, you must add the following top-level mapping to the `databricks.yml` file:

```yaml
# Applies to all tasks of type python_wheel_task.
experimental:
  python_wheel_wrapper: true
```

:::

### <a id="validate-config"></a>Step 3: Validate the project's bundle configuration file

In this step, you check whether the bundle configuration is valid.

1. From the root directory, use the Databricks CLI to run the `bundle validate` command, as follows:

   ```bash
   databricks bundle validate
   ```

1. If a summary of the bundle configuration is returned, then the validation succeeded. If any errors are returned, fix the errors, and then repeat this step.

If you make any changes to your bundle after this step, you should repeat this step to check whether your bundle configuration is still valid.

### Step 4: Build the Python wheel file and deploy the local project to the remote workspace

In this step, the Python wheel file is built and deployed to your remote :re[Databricks] workspace, and a :re[Databricks] job is created within your workspace.

1. Use the Databricks CLI to run the `bundle deploy` command as follows:

   ```bash
   databricks bundle deploy -t dev
   ```

1. To check whether the locally built Python wheel file was deployed:

   1. In your :re[Databricks] workspace's sidebar, click **Workspace**.
   1. Click into the following folder: **Workspace \> Users \> `<your-username>` \> .bundle \> `<project-name>` \> dev \> artifacts \> .internal \> `<random-guid>`**.

   The Python wheel file should be in this folder.

1. To check whether the job was created:

   1. In your :re[Databricks] workspace's sidebar, click **Jobs & Pipelines**.
   1. Optionally, select the **Jobs** and **Owned by me** filters.
   1. Click **[dev `<your-username>`] `<project-name>`\_job**.
   1. Click the **Tasks** tab.

   There should be one task: **main_task**.

If you make any changes to your bundle after this step, repeat steps 3-4 to check whether your bundle configuration is still valid and then redeploy the project.

### Step 5: Run the deployed project

In this step, you run the :re[Databricks] job in your workspace.

1. From the root directory, use the Databricks CLI to run the `bundle run` command, as follows, replacing `<project-name>` with the name of your project from Step 1:

   ```bash
   databricks bundle run -t dev <project-name>_job
   ```

1. Copy the value of `Run URL` that appears in your terminal and paste this value into your web browser to open your :re[Databricks] workspace.
1. In your :re[Databricks] workspace, after the task completes successfully and shows a green title bar, click the **main_task** task to see the results.

## Build the whl using Poetry or setuptools

When you use `databricks bundle init` with the default-python template, a bundle is created that shows how to configure a bundle that builds a Python wheel using `uv` and `pyproject.toml`. However, you may want to use Poetry or `setuptools` instead to build a wheel.

### Install Poetry or setuptools

1. Install Poetry or `setuptools`:

   ::::tabs

   :::tab-item[Poetry]

   - [Install Poetry](https://python-poetry.org/docs/#installation), version 1.6 or above, if it is not already installed. To check your installed version of Poetry, run the command `poetry -V` or `poetry --version`.
   - Make sure you have Python version 3.10 or above installed. To check your version of Python, run the command `python -V` or `python --version`.

   :::

   :::tab-item[setuptools]

   Install the `wheel` and `setuptools` packages if they are not already installed, by running the following command:

   ```bash
   pip3 install --upgrade wheel setuptools
   ```

   :::

   ::::

1. If you intend to store this bundle with a Git provider, add a `.gitignore` file in the project's root, and add the following entries to this file:

   ::::tabs

   :::tab-item[Poetry]

   ```
   .databricks
   dist
   ```

   :::

   :::tab-item[setuptools]

   ```
   .databricks
   build
   dist
   src/my_package/my_package.egg-info
   ```

   :::

   ::::

### Add build files

1. In your bundle's root, create the following folders and files, depending on whether you use Poetry or `setuptools` for building Python wheel files:

   ::::tabs

   :::tab-item[Poetry]

   ```
   ├── src
   │     └── my_package
   │           ├── __init__.py
   │           ├── main.py
   │           └── my_module.py
   └── pyproject.toml
   ```

   :::

   :::tab-item[setuptools]

   ```
   ├── src
   │     └── my_package
   │           ├── __init__.py
   │           ├── main.py
   │           └── my_module.py
   └── setup.py
   ```

   :::

   ::::

1. Add the following code to the `pyproject.toml` or `setup.py` file:

   ::::tabs

   :::tab-item[pyproject.toml]

   ```
   [tool.poetry]
   name = "my_package"
   version = "0.0.1"
   description = "<my-package-description>"
   authors = ["my-author-name <my-author-name>@<my-organization>"]

   [tool.poetry.dependencies]
   python = "^3.10"

   [build-system]
   requires = ["poetry-core"]
   build-backend = "poetry.core.masonry.api"

   [tool.poetry.scripts]
   main = "my_package.main:main"
   ```

   - Replace `my-author-name` with your organization's primary contact name.
   - Replace `my-author-name>@<my-organization` with your organization's primary email contact address.
   - Replace `<my-package-description>` with a display description for your Python wheel file.

   :::

   :::tab-item[setup.py]

   ```python
   from setuptools import setup, find_packages

   import src

   setup(
     name = "my_package",
     version = "0.0.1",
     author = "<my-author-name>",
     url = "https://<my-url>",
     author_email = "<my-author-name>@<my-organization>",
     description = "<my-package-description>",
     packages=find_packages(where='./src'),
     package_dir={'': 'src'},
     entry_points={
       "packages": [
         "main=my_package.main:main"
       ]
     },
     install_requires=[
       "setuptools"
     ]
   )
   ```

   - Replace `https://<my-url>` with your organization's URL.
   - Replace `<my-author-name>` with your organization's primary contact name.
   - Replace `<my-author-name>@<my-organization>` with your organization's primary email contact address.
   - Replace `<my-package-description>` with a display description for your Python wheel file.

   :::

   ::::

### <a id="config-file"></a>Add artifacts bundle configuration

1. Add the `artifacts` mapping configuration to your `databricks.yml` to build the `whl` artifact:

   :::::tabs

   ::::tab-item[Poetry]

   This configuration runs the `poetry build` command and indicates the path to the `pyproject.toml` file is in the same directory as the `databricks.yml` file.

   :::note

   If you have already built a Python wheel file and just want to deploy it, then modify the following bundle configuration file by omitting the `artifacts` mapping. The Databricks CLI will then assume that the Python wheel file is already built and will automatically deploy the files that are specified in the `libraries` array's `whl` entries.

   :::

   :::aws

   ```yaml
   bundle:
     name: my-wheel-bundle

   artifacts:
     default:
       type: whl
       build: poetry build
       path: .

   resources:
     jobs:
       wheel-job:
         name: wheel-job
         tasks:
           - task_key: wheel-task
             new_cluster:
               spark_version: 13.3.x-scala2.12
               node_type_id: i3.xlarge
               data_security_mode: USER_ISOLATION
               num_workers: 1
             python_wheel_task:
               entry_point: main
               package_name: my_package
             libraries:
               - whl: ./dist/*.whl

   targets:
     dev:
       workspace:
       host: <workspace-url>
   ```

   :::

   :::azure

   ```yaml
   bundle:
     name: my-wheel-bundle

   artifacts:
     default:
       type: whl
       build: poetry build
       path: .

   resources:
     jobs:
       wheel-job:
         name: wheel-job
         tasks:
           - task_key: wheel-task
             new_cluster:
               spark_version: 13.3.x-scala2.12
               node_type_id: Standard_DS3_v2
               data_security_mode: USER_ISOLATION
               num_workers: 1
             python_wheel_task:
               entry_point: main
               package_name: my_package
             libraries:
               - whl: ./dist/*.whl

   targets:
     dev:
       workspace:
       host: <workspace-url>
   ```

   :::

   :::gcp

   ```yaml
   bundle:
     name: my-wheel-bundle

   artifacts:
     default:
       type: whl
       build: poetry build
       path: .

   resources:
     jobs:
       wheel-job:
         name: wheel-job
         tasks:
           - task_key: wheel-task
             new_cluster:
               spark_version: 13.3.x-scala2.12
               node_type_id: n2-highmem-4
               data_security_mode: USER_ISOLATION
               num_workers: 1
             python_wheel_task:
               entry_point: main
               package_name: my_package
             libraries:
               - whl: ./dist/*.whl

   targets:
     dev:
       workspace:
       host: <workspace-url>
   ```

   :::

   ::::

   ::::tab-item[setuptools]

   This configuration runs the `setuptools` command and indicates the path to the `setup.py` file is in the same directory as the `databricks.yml` file.

   :::aws

   ```yaml
   bundle:
     name: my-wheel-bundle

   artifacts:
     default:
       type: whl
       build: python3 setup.py bdist wheel
       path: .

   resources:
     jobs:
       wheel-job:
         name: wheel-job
         tasks:
           - task_key: wheel-task
             new_cluster:
               spark_version: 13.3.x-scala2.12
               node_type_id: i3.xlarge
               data_security_mode: USER_ISOLATION
               num_workers: 1
             python_wheel_task:
               entry_point: main
               package_name: my_package
             libraries:
               - whl: ./dist/*.whl

   targets:
     dev:
       workspace:
       host: <workspace-url>
   ```

   :::

   :::azure

   ```yaml
   bundle:
     name: my-wheel-bundle

   artifacts:
     default:
       type: whl
       build: python3 setup.py bdist wheel
       path: .

   resources:
     jobs:
       wheel-job:
         name: wheel-job
         tasks:
           - task_key: wheel-task
             new_cluster:
               spark_version: 13.3.x-scala2.12
               node_type_id: Standard_DS3_v2
               data_security_mode: USER_ISOLATION
               num_workers: 1
             python_wheel_task:
               entry_point: main
               package_name: my_package
             libraries:
               - whl: ./dist/*.whl

   targets:
     dev:
       workspace:
       host: <workspace-url>
   ```

   :::

   :::gcp

   ```yaml
   bundle:
     name: my-wheel-bundle

   artifacts:
     default:
       type: whl
       build: python3 setup.py bdist wheel
       path: .

   resources:
     jobs:
       wheel-job:
         name: wheel-job
         tasks:
           - task_key: wheel-task
             new_cluster:
               spark_version: 13.3.x-scala2.12
               node_type_id: n2-highmem-4
               data_security_mode: USER_ISOLATION
               num_workers: 1
             python_wheel_task:
               entry_point: main
               package_name: my_package
             libraries:
               - whl: ./dist/*.whl

   targets:
     dev:
       workspace:
       host: <workspace-url>
   ```

   :::

   ::::

   :::::
