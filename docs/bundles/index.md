---
description: 'Learn about :re[DABS], which enable programmatic management of resources such as Lakeflow Jobs, :re[LDP], and MLOps stacks.'
last_update:
  date: 2025-06-03
---

# What are :re[DABS]?

:re[DABS] are a tool to facilitate the adoption of software engineering best practices, including source control, code review, testing, and continuous integration and delivery (CI/CD), for your data and AI projects. Bundles provide a way to include metadata alongside your project's source files and make it possible to describe Databricks resources such as jobs and pipelines as source files. Ultimately a bundle is an end-to-end definition of a project, including how the project should be structured, tested, and deployed. This makes it easier to collaborate on projects during active development.

Your bundle project's collection of source files and metadata is deployed as a single bundle to your target environment. A bundle includes the following parts:

- Required cloud infrastructure and workspace configurations
- Source files, such as notebooks and Python files, that include the business logic
- Definitions and settings for Databricks resources, such as Lakeflow Jobs, :re[LDP], Model Serving endpoints, MLflow Experiments, and MLflow registered models
- Unit tests and integration tests

The following diagram provides a high-level view of a development and CI/CD pipeline with bundles:

![Databricks Asset Bundles overview](/images/bundles/bundles-cicd.png)

## When should I use :re[DABS]?

Databricks Assets Bundles are an infrastructure-as-code (IaC) approach to managing your Databricks projects. Use them when you want to manage complex projects where multiple contributors and automation are essential, and continuous integration and deployment (CI/CD) are a requirement. Since bundles are defined and managed through YAML templates and files you create and maintain alongside source code, they map well to scenarios where IaC is an appropriate approach.

Some ideal scenarios for bundles include:

- Develop data, analytics, and ML projects in a team-based environment. Bundles can help you organize and manage various source files efficiently. This ensures smooth collaboration and streamlined processes.
- Iterate on ML problems faster. Manage ML pipeline resources (such as training and batch inference jobs) by using ML projects that follow production best practices from the beginning.
- Set organizational standards for new projects by authoring custom bundle templates that include default permissions, service principals, and CI/CD configurations.
- Regulatory compliance: In industries where regulatory compliance is a significant concern, bundles can help maintain a versioned history of code and infrastructure work. This assists in governance and ensures that necessary compliance standards are met.

## How do :re[DABS] work?

Bundle metadata is defined using YAML files that specify the artifacts, resources, and configuration of a Databricks project. The Databricks CLI can then be used to validate, deploy, and run bundles using these bundle YAML files. You can run bundle projects from IDEs, terminals, or within Databricks directly.

Bundles can be created manually or based on a template. The Databricks CLI provides default templates for simple use cases, but for more specific or complex jobs, you can create custom bundle templates to implement your team's best practices and keep common configurations consistent.

For more details on the configuration YAML used to express :re[DABS], see [\_](/dev-tools/bundles/settings.md).

## Requirements

:re[DABS] are a feature of the Databricks CLI. You build bundles locally, then use the Databricks CLI to deploy your bundles to target remote Databricks workspaces and run bundle workflows in those workspaces from the command line.

To build, deploy, and run bundles in your :re[Databricks] workspaces:

- Your remote Databricks workspaces must have workspace files enabled. If you're using :re[DBR] version 11.3 LTS or above, this feature is enabled by default.
- You must install the Databricks CLI, version v0.218.0 or above. To install or update the Databricks CLI, see [\_](/dev-tools/cli/install.md).

  Databricks recommends that you regularly update to the latest version of the CLI to take advantage of [new bundle features](/release-notes/dev-tools/bundles.md). To find the version of the Databricks CLI that is installed, run the following command:

  ```sh
  databricks --version
  ```

- You have configured the Databricks CLI to access your Databricks workspaces. Databricks recommends configuring access using OAuth user-to-machine (U2M) authentication, which is described in [\_](/dev-tools/cli/tutorial.md#auth). Other authentication methods are described in [\_](/dev-tools/bundles/authentication.md).

## How do I get started with bundles?

The fastest way to start bundle development is using a bundle project template. Create your first bundle project using the Databricks CLI [bundle init command](/dev-tools/cli/bundle-commands.md#init). This command presents a choice of Databricks-provided default bundle templates and asks a series of questions to initialize project variables.

```sh
databricks bundle init
```

Creating your bundle is the first step in the [lifecycle of a bundle](/dev-tools/bundles/work-tasks.md#lifecycle). Next, develop your bundle by defining bundle settings and resources in the `databricks.yml` and resource [configuration files](/dev-tools/bundles/settings.md). Finally, [validate](/dev-tools/bundles/work-tasks.md#validate) and [deploy](/dev-tools/bundles/work-tasks.md#deploy) your bundle, then [run your workflows](/dev-tools/bundles/work-tasks.md#run).

:::tip

Bundle configuration examples can be found in [\_](/dev-tools/bundles/examples.md) and the [Bundle examples repository in GitHub](https://github.com/databricks/bundle-examples).

:::

## Next steps

- Create a bundle that deploys a notebook to :re[a Databricks] workspace and then runs that deployed notebook in :re[a Databricks] job or pipeline. See [\_](/dev-tools/bundles/jobs-tutorial.md) and [\_](/dev-tools/bundles/pipelines-tutorial.md).
- Create a bundle that deploys and runs an MLOps Stack. See [\_](/dev-tools/bundles/mlops-stacks.md).
- Kick off a bundle deployment as part of a CI/CD (continuous integration/continuous deployment) workflow in GitHub. See [\_](/dev-tools/ci-cd/github.md#bundle).
- Create a bundle that builds, deploys, and calls a Python wheel file. See [\_](/dev-tools/bundles/python-wheel.md).
- Generate configuration in your bundle for a job or other resource in your workspace, then bind it to the resource in the workspace so that configuration stays in sync. See [\_](/dev-tools/cli/bundle-commands.md#generate) and [\_](/dev-tools/cli/bundle-commands.md#bind).
- Create and deploy a bundle in the workspace. See [\_](/dev-tools/bundles/workspace.md).
- Create a custom template that you and others can use to create a bundle. A custom template might include default permissions, service principals, and custom CI/CD configuration. See [\_](/dev-tools/bundles/templates.md).
- Migrate from dbx to :re[DABS]. See [\_](/archive/dev-tools/dbx/dbx-migrate.md).
- Discover the latest major new features released for :re[DABS]. See [\_](/release-notes/dev-tools/bundles.md).
