---
description: 'Complete a tutorial that demonstrates how to develop and deploy Databricks apps using :re[DABS].'
last_update:
  date: 2025-05-15
---

# Manage Databricks apps using :re[DABS]

Databricks Apps lets you create secure data and AI applications on the Databricks platform that you can easily share with users. You can manage deployments of your apps using :re[DABS]. For more information about apps and bundles, see [\_](/dev-tools/databricks-apps/index.md) and [\_](/dev-tools/bundles/index.md).

This article walks you through developing a Databricks app locally, then configuring a bundle to manage deployments of the app to the Databricks workspace using :re[DABS].

:::tip

To initialize an example bundle with a Streamlit app, use the streamlit-app bundle template with the `bundle init` command:

    ```bash
    databricks bundle init https://github.com/databricks/bundle-examples --template-dir contrib/templates/streamlit-app
    ```

:::

## Requirements

- Your Databricks workspace and local development environment must meet the requirements for Databricks Apps. See [\_](/dev-tools/databricks-apps/configure-env.md).
- Databricks CLI version 0.250.0 or above. To check your installed version of the Databricks CLI, run the command `databricks -v`. To install the Databricks CLI, see [\_](/dev-tools/cli/install.md).

## Create an app locally

First, create a Databricks app. Apps are developed in Python using popular frameworks, such as Dash or Gradio. You can build a Databricks app locally from scratch, create one in the Databricks workspace and then sync the files to your local machine, or get a Databricks sample app from GitHub.

- To build an app from scratch:

  1. Follow a quick start tutorial for a framework:

     - [Dash](https://dash.plotly.com/tutorial)
     - [Flask](https://flask.palletsprojects.com/en/stable/quickstart/)
     - [Gradio](https://www.gradio.app/guides/quickstart)
     - [Shiny](https://shiny.posit.co/py/get-started/)
     - [Streamlit](https://docs.streamlit.io/get-started/tutorials/create-an-app)

  1. Add an `app.yaml` file to the root of your project to define how to run your main Python app. For example:

     For a Streamlit app:

     ```yaml
     command: ['streamlit', 'run', 'app.py']
     ```

     Or for a Dash app:

     ```yaml
     command: ['python', 'app.py']
     ```

- To create an app in the workspace and sync it locally:

  1. Follow the steps in [\_](/dev-tools/databricks-apps/create-custom-app.md) to create an app in the UI.
  1. Create a local directory for the app and `cd` into it:

     ```bash
     mkdir hello-world-app
     cd hello-world-app
     ```

  1. Sync the app files locally. You can copy the `databricks workspace export-dir` command from the app installation page in the workspace UI and run it at your command line. For example:

     ```bash
     databricks workspace export-dir /Workspace/Users/someone@example.com/databricks_apps/hello-world_2025_05_09-17_43/hello-world-app .
     ```

     This downloads the app files in the workspace directory to the `hello-world-app` directory on your local machine.

- To get a Databricks sample app from GitHub:

  1. Clone the Databricks [app templates GitHub repository](https://github.com/databricks/app-templates):

     ```bash
     git clone https://github.com/databricks/app-templates
     ```

  1. Choose one of the sample apps as a simple app project.

### Add an existing app to an existing bundle

If you have a Databricks app in your workspace, and have an existing bundle that you want to add the app to, you can use the `databricks bundle generate app` command. This command generates a configuration file for the app and downloads all source code files for the app, and adds these to your bundle. For example:

```bash
databricks bundle generate app --existing-app-name hello-world-app
```

After you have generated the app configuration in your bundle, use the `databricks bundle bind` command to keep the app in the workspace and bundle in sync.

For more information about `databricks bundle generate` and `databricks bundle bind`, see [\_](/dev-tools/cli/bundle-commands.md).

## Develop and debug the app locally

Next, continue developing your app locally. Launch and debug the app using the `databricks apps run-local` command. This command starts an app proxy which is used to proxy requests to the app itself and injects necessary Databricks app-related headers.

1. To install all dependencies and prepare the virtual environment, then start the app and debugger, use the `run-local` command with the `--prepare-environment` and `--debug` options:

   ```bash
   databricks apps run-local --prepare-environment --debug
   ```

   This command uses `uv` to prepare the virtual environment and the debugger is based on `debugpy`.

1. Navigate to `http://localhost:8001` to view your app.
1. Set breakpoints to debug your app. In Visual Studio Code, install the Python debugger, then select **Run** \> **Start Debugging** and then **Remote Attach**.

   The proxy starts on port 5678, but you can configure it using the `--port` option.

## Deploy the app to the workspace using bundles

When you are ready to deploy your app to the workspace, add bundle configuration that creates the app, then deploy the bundle.

1. Create a file `databricks.yml` at the root of your app project. The Databricks CLI recognizes a folder with a `databricks.yml` file at its root as a bundle, which enables [databricks bundle commands](/dev-tools/cli/bundle-commands.md).
1. Copy and paste the following YAML into the `databricks.yml` file, substituting placeholder workspace and username values for your own:

   ```yaml
   bundle:
     name: hello_world_bundle

   resources:
     apps:
       hello_world_app:
         name: 'hello-world-app'
         source_code_path: . # This assumes the app source code is at the root of the project.
         description: 'A Databricks app'

   targets:
     dev:
       mode: development
       default: true
       workspace:
         host: https://myworkspace.cloud.databricks.com
     prod:
       mode: production
       workspace:
         host: https://myworkspace.cloud.databricks.com
         root_path: /Workspace/Users/someone@example.com/.bundle/${bundle.name}/${bundle.target}
       permissions:
         - user_name: someone@example.com
           level: CAN_MANAGE
   ```

1. Validate, then deploy the bundle. By default, this creates the app and bundle in the `dev` target in the workspace.

   ```bash
   databricks bundle validate
   ```

   ```bash
   databricks bundle deploy
   ```

1. Use the `bundle summary` command to retrieve the app resource URL to open the app page in the workspace:

   ```bash
   databricks bundle summary
   ```

   ```Output
   Name: hello_world_bundle
   Target: dev
   Workspace:
     Host: https://myworkspace.cloud.databricks.com
     User: someone@example.com
     Path: /Workspace/Users/someone@example.com/.bundle/hello_world_bundle/dev
   Resources:
     Apps:
       hello_world_app:
         Name: hello-world-app
         URL:  https://myworkspace.cloud.databricks.com/apps/hello-world-app?o=8498204313176880
   ```

## Develop, test, then deploy to production

Continue to make changes to your app locally, then redeploy the bundle to update the app in the workspace. To start the app in the workspace, run the app in the bundle by specifying the resource key for the app in the command:

```bash
databricks bundle run hello_world_app
```

When you are ready to make the app available in production, deploy the bundle to your target production workspace and run the app:

```bash
databricks bundle deploy -t prod
databricks bundle run hello_world_app -t prod
```

## Additional resources

- [\_](/dev-tools/cli/index.md)
- [\_](/dev-tools/cli/bundle-commands.md)
- [\_](/dev-tools/bundles/settings.md)
- [\_](/dev-tools/databricks-apps/get-started.md)
