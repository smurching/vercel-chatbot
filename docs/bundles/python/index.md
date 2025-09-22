---
description: 'Learn how to work with Python for :re[DABS]'
last_update:
  date: 2025-06-18
---

# Bundle configuration in Python

:::info[Preview]

:re[python-dabs] is in [Public Preview](/release-notes/release-types.md).

:::

Python for Databricks Asset Bundles extends [Databricks Asset Bundles](/dev-tools/bundles/index.md) so that you can:

- Define jobs and pipelines as Python code. These definitions can coexist with those defined in YAML.
- Dynamically create jobs or pipelines using metadata. See [Create resources using metadata](#metadata).
- Modify jobs defined in YAML or Python during bundle deployment. See [Modify jobs defined in YAML or Python](#modify).

Reference documentation for the :re[python-dabs] [databricks-bundles package](https://pypi.org/project/databricks-bundles) is available at [https://databricks.github.io/cli/experimental/python/](https://databricks.github.io/cli/experimental/python/).

## Requirements

To use :re[python-dabs], you must first:

1. Install the [Databricks CLI](/dev-tools/cli/index.md), version 0.248.0 or above. See [Install or update the Databricks CLI](/dev-tools/cli/install.md).
2. Authenticate to your Databricks workspace if you have not done so already:

   ```bash
   databricks configure
   ```

3. Install [uv](https://docs.astral.sh/uv). See [Installing uv](https://docs.astral.sh/uv/getting-started/installation/). Python for :re[DABS] uses uv to create a virtual environment and install the required dependencies. Alternatively, you can configure your Python environment using other tools such as [venv](https://docs.python.org/3/library/venv.html).

## <a id="template"></a>Create a project from the template

To create a new :re[python-dabs] project, initialize a bundle using the `experimental-jobs-as-code` template:

```bash
databricks bundle init experimental-jobs-as-code
```

When prompted, give your project a name, such as `my_jobs_as_code_project`, and accept the inclusion of a notebook and Python package.

Now create a new virtual environment in your new project folder:

```bash
cd my_jobs_as_code_project
uv sync
```

By default, the template includes an example of a job defined as Python in the `resources/my_jobs_as_code_project_job.py` file:

```python
from databricks.bundles.jobs import Job


my_jobs_as_code_project_job = Job.from_dict(
    {
        "name": "my_jobs_as_code_project_job",
        "tasks": [
            {
                "task_key": "notebook_task",
                "notebook_task": {
                    "notebook_path": "src/notebook.ipynb",
                },
            },
        ],
    },
)
```

The `Job.from_dict` function accepts a Python dictionary using the same format as YAML. Jobs can be also constructed using dataclass syntax:

```python
from databricks.bundles.jobs import Job, Task, NotebookTask


my_jobs_as_code_project_job = Job(
    name="my_jobs_as_code_project_job",
    tasks=[
        Task(
            task_key="notebook_task",
            notebook_task=NotebookTask(
                notebook_path="src/notebook.ipynb",
            ),
        ),
    ],
)
```

Python files are loaded through an entry point specified in the `experimental` section in `databricks.yml`:

```yaml
experimental:
  python:
    # Activate the virtual environment before loading resources defined in
    # Python. If disabled, it defaults to using the Python interpreter
    # available in the current shell.
    venv_path: .venv
    # Functions called to load resources defined in Python.
    # See resources/__init__.py
    resources:
      - 'resources:load_resources'
```

By default, `resources/__init__.py` contains a function that loads all Python files in the resources package.

```python
from databricks.bundles.core import (
    Bundle,
    Resources,
    load_resources_from_current_package_module,
)


def load_resources(bundle: Bundle) -> Resources:
    """
    'load_resources' function is referenced in databricks.yml and is responsible for loading
    bundle resources defined in Python code. This function is called by Databricks CLI during
    bundle deployment. After deployment, this function is not used.
    """

    # the default implementation loads all Python files in 'resources' directory
    return load_resources_from_current_package_module()
```

## Deploy and run jobs or pipelines

To deploy the bundle to the development target, use the [bundle deploy command](/dev-tools/cli/bundle-commands.md#deploy) from the bundle project root:

```bash
databricks bundle deploy --target dev
```

This command deploys everything defined for the bundle project. For example, a project created using the default template deploys a job called `[dev yourname] my_jobs_as_code_project_job` to your workspace. You can find that job by navigating to **Jobs & Pipelines** in your Databricks workspace.

After the bundle is deployed, you can use the [bundle summary command](/dev-tools/cli/bundle-commands.md#summary) to review everything that is deployed:

```bash
databricks bundle summary --target dev
```

Finally, to run a job or pipeline, use the [bundle run command](/dev-tools/cli/bundle-commands.md#run):

```bash
databricks bundle run my_jobs_as_code_project_job
```

## Update existing bundles

To update existing bundles, model the project template structure as described in [Create a project from a template](#template). Existing bundles with YAML can be updated to include jobs or pipelines defined as Python code by adding an `experimental.python` section in `databricks.yml`:

```yaml
experimental:
  python:
    # Activate the virtual environment before loading resources defined in
    # Python. If disabled, it defaults to using the Python interpreter
    # available in the current shell.
    venv_path: .venv
    # Functions called to load resources defined in Python.
    # See resources/__init__.py
    resources:
      - 'resources:load_resources'
```

The specified [virtual environment](https://docs.python.org/3/library/venv.html) must contain the installed [databricks-bundles](https://pypi.org/project/databricks-bundles) PyPi package.

```bash
pip install databricks-bundles==0.248.0
```

The resources folder must contain `__init__.py` file:

```python
from databricks.bundles.core import (
    Bundle,
    Resources,
    load_resources_from_current_package_module,
)


def load_resources(bundle: Bundle) -> Resources:
    """
    'load_resources' function is referenced in databricks.yml and
    is responsible for loading bundle resources defined in Python code.
    This function is called by Databricks CLI during bundle deployment.
    After deployment, this function is not used.
    """

    # default implementation loads all Python files in 'resources' folder
    return load_resources_from_current_package_module()
```

## Convert existing jobs into Python

To convert existing jobs into Python, you can use the **View as code** feature. See [View jobs as code](/jobs/automate.md#view-code).

1. Open a job page in Databricks Workflows.
2. Click the kebab to the left of the **Run now** button, then click **View as code**:

![View as code menu item](/images/bundles/view-as-code-menu.png)

3. Select **Python**, then **Databricks Asset Bundles**

![View as code, Python](/images/bundles/view-as-code-python.png)

4. Click **Copy** and save the generated Python as a Python file in the resources folder of the bundle project.

:::tip

You can also view and copy YAML for existing jobs and pipelines that you can paste directly into your bundle configuration YAML files.

:::

## <a id="metadata"></a>Create resources using metadata

The default implementation of the `load_resources` function loads Python files in the `resources` package. You can use Python to create resources programmatically. For example, you can load configuration files and create jobs in a loop:

```python
from databricks.bundles.core import (
    Bundle,
    Resources,
    load_resources_from_current_package_module,
)


from databricks.bundles.jobs import Job


def create_job(country: str):
    my_notebook = {
        "task_key": "my_notebook",
        "notebook_task": {
            "notebook_path": "files/my_notebook.py",
        },
    }


    return Job.from_dict(
        {
            "name": f"my_job_{country}",
            "tasks": [my_notebook],
        }
    )


def load_resources(bundle: Bundle) -> Resources:
    resources = load_resources_from_current_package_module()


    for country in ["US", "NL"]:
        resources.add_resource(f"my_job_{country}", create_job(country))


    return resources
```

## Access bundle variables

The `bundle` parameter can be used to access bundle variables and the deployment target:

```python
from databricks.bundles.core import Bundle, Resources, Variable, variables

@variables
class Variables:
    warehouse_id: Variable[str]


def load_resources(bundle: Bundle) -> Resources:
    warehouse_id = bundle.resolve_variable(Variables.warehouse_id)

    ...
```

See the [Resources](https://databricks.github.io/cli/experimental/python/databricks.bundles.core.html#databricks.bundles.core.Resources) and [Bundle](https://databricks.github.io/cli/experimental/python/databricks.bundles.core.html#databricks.bundles.core.Bundle) class reference for more information.

## <a id="modify"></a>Modify jobs defined in YAML or Python

You can reference job mutator functions in `databricks.yml`, similar to functions loading resources. This feature can be used independently of loading jobs defined in Python and mutates resources defined in both YAML and Python.

First, create `mutators.py` in the bundle root with the following contents:

```python
from dataclasses import replace


from databricks.bundles.core import Bundle, job_mutator
from databricks.bundles.jobs import Job, JobEmailNotifications


@job_mutator
def add_email_notifications(bundle: Bundle, job: Job) -> Job:
    if job.email_notifications:
        return job


    email_notifications = JobEmailNotifications.from_dict(
        {
            "on_failure": ["${workspace.current_user.userName}"],
        }
    )


    return replace(job, email_notifications=email_notifications)
```

Now use the following configuration to execute the `add_email_notifications` function during bundle deployment. This updates every job defined in the bundle with email notifications if they are absent. Mutator functions have to be specified in `databricks.yml`, and are executed in the specified order. Job mutators are executed for every job defined in a bundle and can either return an updated copy or unmodified input. Mutators can also be used for other fields, such as configuring default job clusters or SQL warehouses.

```yaml
experimental:
  python:
    mutators:
      - 'mutators:add_email_notifications'
```

If functions throw an exception during the mutator execution, the bundle deployment is aborted.
