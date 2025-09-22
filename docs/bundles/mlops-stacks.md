---
description: 'Learn about how to use :re[DABS] to work with MLOps Stacks.'
last_update:
  date: 2024-10-30
---

# :re[DABS] for MLOps Stacks

You can use :re[DABS], the Databricks CLI, and the [Databricks MLOps Stack](https://github.com/databricks/mlops-stack) repository on GitHub to create _MLOps Stacks_. An MLOps Stack is an [MLOps](/machine-learning/mlops/mlops-workflow.md) project on :re[Databricks] that follows production best practices out of the box. See [\_](/dev-tools/bundles/index.md).

This shows how to create, deploy, and run an MLOps Stacks bundle project.

## Requirements

- Make sure that the target remote workspace has workspace files enabled. See [\_](/files/workspace.md).
- On your development machine, make sure that Databricks CLI version 0.212.2 or above is installed. To check your installed Databricks CLI version, run the command `databricks -v`. To update your Databricks CLI version, see [\_](/dev-tools/cli/install.md). (Bundles do not work with :re[databricks-cli-legacy-and].)

## Step 1: Set up authentication

Configure the Databricks CLI for authentication.

This article assumes that you want to use OAuth user-to-machine (U2M) authentication and a corresponding :re[Databricks] configuration profile named `DEFAULT` for authentication.

:::note

U2M authentication is appropriate for trying out these steps in real time. For fully automated workflows, Databricks recommends that you use OAuth machine-to-machine (M2M) authentication instead. See the M2M authentication setup instructions in [\_](/dev-tools/auth/oauth-m2m.md).

:::

::include[dev-tools/oauth-u2m-setup-cli-workspace.md]

## Step 2: Create the bundle project

1. Use [Databricks Asset Bundle templates](/dev-tools/bundles/templates.md) to create your MLOps Stacks project's starter files. To do this, begin by running the following command:

   ```bash
   databricks bundle init mlops-stacks
   ```

1. Answer the on-screen prompts. For guidance on answering these prompts, see [Start a new project](https://github.com/databricks/mlops-stacks/blob/main/README.md#start-a-new-project) in the [Databricks MLOps Stacks](https://github.com/databricks/mlops-stacks) repository on GitHub.

   The first prompt offers the option of setting up the ML code components, the CI/CD components, or both. This option simplifies the initial setup as you can choose to create only those components that are immediately relevant. (To set up the other components, run the initialization command again.) Select one of the following:

   - `CICD_and_Project` (default) - Set up both ML code and CI/CD components.
   - `Project_Only` - Set up ML code components only. This option is for data scientists to get started.
   - `CICD_Only` - Set up CI/CD components only. This option is for ML engineers to set up infrastructure.

   After you answer all of the on-screen prompts, the template creates your MLOps Stacks project's starter files and adds them to your current working directory.

1. Customize your MLOps Stacks project's starter files as desired. To do this, follow the guidance in the following files within your new project:

   | Role                          | Goal                                                                                  | Docs                                 |
   | ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------ |
   | First-time users of this repo | Understand the ML pipeline and code structure in this repo                            | `README.md`                          |
   | Data Scientist                | Get started writing ML code for a brand new project                                   | `<project-name>/README.md`           |
   | Data Scientist                | Update production ML code (for example, model training logic) for an existing project | `docs/ml-pull-request.md`            |
   | Data Scientist                | Modify production model ML resources (for example, model training or inference jobs)  | `<project-name>/resources/README.md` |
   | MLOps / DevOps                | Set up CI/CD for the current ML project                                               | `docs/mlops-setup.md`                |

   - For customizing experiments, the mappings within an experiment declaration correspond to the create experiment operation's request payload as defined in [POST /api/2.0/mlflow/experiments/create](https://docs.databricks.com/api/workspace/experiments/createexperiment) in the REST API reference, expressed in YAML format.
   - For customizing jobs, the mappings within a job declaration correspond to the create job operation's request payload as defined in [POST /api/2.1/jobs/create](https://docs.databricks.com/api/workspace/jobs/create) in the REST API reference, expressed in YAML format.

     :::tip

     You can define, combine, and override the settings for new job clusters in bundles by using the techniques described in [\_](/dev-tools/bundles/cluster-override.md).

     :::

   - For customizing models, the mappings within a model declaration correspond to the create :re[UC] model operation's request payload as defined in [POST /api/2.1/unity-catalog/models](https://docs.databricks.com/api/workspace/registeredmodels/create) in the REST API reference, expressed in YAML format.
   - For customizing pipelines, the mappings within a pipeline declaration correspond to the create pipeline operation's request payload as defined in [POST /api/2.0/pipelines](https://docs.databricks.com/api/workspace/pipelines/create) in the REST API reference, expressed in YAML format.

## Step 3: Validate the bundle project

Check whether the bundle configuration is valid. To do this, run the Databricks CLI from the project's root, where the `databricks.yml` is located, as follows:

```bash
databricks bundle validate
```

If a summary of the bundle configuration is returned, then the validation succeeded. If any errors are returned, fix the errors, and then repeat this step.

## Step 4: Deploy the bundle

Deploy the project's resources and artifacts to the desired remote workspace. To do this, run the Databricks CLI from the project's root, where the `databricks.yml` is located, as follows:

```bash
databricks bundle deploy -t <target-name>
```

Replace `<target-name>` with the name of the desired target within the `databricks.yml` file, for example `dev`, `test`, `staging`, or `prod`.

## Step 5: Run the deployed bundle

The project's deployed jobs automatically run on their predefined schedules. To run a deployed job immediately, run the Databricks CLI from the project's root, where the `databricks.yml` is located, as follows:

```bash
databricks bundle run -t <target-name> <job-name>
```

- Replace `<target-name>` with the name of the desired target within the `databricks.yml` file where the job was deployed, for example `dev`, `test`, `staging`, or `prod`.
- Replace `<job-name>` with the name of the job in one of the `.yml` files within `<project-name>/databricks-resources`, for example `batch_inference_job`, `write_feature_table_job`, or `model_training_job`.

A link to the :re[Databricks] job appears, which you can copy into your web browser to open the job within the :re[Databricks] UI.

## Step 6: Delete the deployed bundle (optional)

To delete a deployed project's resources and artifacts if you no longer need them, run the Databricks CLI from the project's root, where the `databricks.yml` is located, as follows:

```bash
databricks bundle destroy -t <target-name>
```

Replace `<target-name>` with the name of the desired target within the `databricks.yml` file, for example `dev`, `test`, `staging`, or `prod`.

Answer the on-screen prompts to confirm the deletion of the previously deployed resources and artifacts.
