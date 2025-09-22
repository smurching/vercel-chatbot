---
description: 'Learn about using Databricks Asset Bundles for your CI/CD pipeline. Bundles enable programmatic management of Databricks workflows.'
last_update:
  date: 2025-04-28
---

# CI/CD using :re[DABS]

:re[Databricks] recommends using [Databricks Asset Bundles](/dev-tools/bundles/index.md) for CI/CD, which simplify the development and deployment of complex data, analytics, and ML projects for the :re[Databricks] platform. Bundles allow you to easily manage many custom configurations and automate builds, tests, and deployments of your projects to :re[Databricks] development, staging, and production workspaces.

For more information about recommended CI/CD best practices and workflows with bundles, see [\_](/dev-tools/ci-cd/best-practices.md).

For information about other approaches to CI/CD in Databricks, see [\_](/dev-tools/ci-cd/index.md).

## How do I use :re[DABS] as part of my CI/CD pipeline on :re[Databricks]?

You can use [Databricks Asset Bundles](/dev-tools/bundles/index.md) to define and programmatically manage your :re[Databricks] CI/CD implementation, which usually includes:

- **Notebooks**: :re[Databricks] notebooks are often a key part of data engineering and data science workflows. You can use version control for notebooks, and also validate and test them as part of a CI/CD pipeline. You can run automated tests against notebooks to check whether they are functioning as expected.
- **Libraries**: Manage the [library dependencies](/dev-tools/bundles/library-dependencies.md) required to run your deployed code. Use version control on libraries and include them in automated testing and validation.
- **Workflows**: [Lakeflow Jobs](/jobs/index.md) are comprised of jobs that allow you to schedule and run automated tasks using notebooks or Spark jobs.
- **Data pipelines**: You can also include data pipelines in CI/CD automation, using [Lakeflow Declarative Pipelines](/dlt/index.md), the framework in Databricks for declaring data pipelines.
- **Infrastructure**: Infrastructure configuration includes definitions and provisioning information for clusters, workspaces, and storage for target environments. Infrastructure changes can be validated and tested as part of a CI/CD pipeline, ensuring that they are consistent and error-free.

A common flow for :re[a Databricks] CI/CD pipeline with bundles is:

1. **Store**: Store your :re[Databricks] code and notebooks in a version control system like Git. This allows you to track changes over time and collaborate with other team members. See [\_](/repos/ci-cd.md) and [bundle Git settings](/dev-tools/bundles/settings.md#bundle-git).
1. **Code**: Develop code and unit tests in :re[a Databricks] notebook in the workspace or locally using an external IDE. :re[Databricks] provides a [Visual Studio Code extension](/dev-tools/vscode-ext/index.md) that makes it easy to develop and deploy changes to :re[Databricks] workspaces.
1. **Build**: Use :re[DABS] settings to automatically build certain artifacts during deployments. See [\_](/dev-tools/bundles/settings.md#artifacts). In addition, [Pylint](https://www.pylint.org/) extended with the [Databricks Labs pylint plugin](https://github.com/databrickslabs/pylint-plugin) help to enforce coding standards and detect bugs in your Databricks notebooks and application code.
1. **Deploy**: Deploy changes to the :re[Databricks] workspace using :re[DABS] in conjunction with tools like Azure DevOps, Jenkins, or GitHub Actions. See [\_](/dev-tools/bundles/deployment-modes.md). For GitHub Actions examples, see [\_](/dev-tools/ci-cd/github.md).
1. **Test**: Develop and run automated tests to validate your code changes using tools like [pytest](https://docs.pytest.org/). To test your integrations with workspace APIs, the [Databricks Labs pytest plugin](https://github.com/databrickslabs/pytester) allows you to create workspace objects and clean them up after tests finish.
1. **Run**: Use the Databricks CLI in conjunction with :re[DABS] to automate runs in your :re[Databricks] workspaces. See [\_](/dev-tools/cli/bundle-commands.md#run).
1. **Monitor**: Monitor the performance of your code and workflows in :re[Databricks] using tools like Azure Monitor or Datadog. This helps you identify and resolve any issues that arise in your production environment.
1. **Iterate**: Make small, frequent iterations to improve and update your data engineering or data science project. Small changes are easier to roll back than large ones.
