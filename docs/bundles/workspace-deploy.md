---
description: 'Learn how to deploy and run :re[DABS] from the workspace.'
last_update:
  date: 2025-08-12
---

# Deploy bundles and run workflows from the workspace

:::info[Preview]

:re[DABS] in the workspace is in [Public Preview](/release-notes/release-types.md).

:::

Assets that are part of your :re[DABS] can be created and modified from a local development environment or the workspace, but in order for the changes to be synchronized with the corresponding Databricks resources, bundles must be deployed. Bundles have unique identities in a workspace, so regardless of whether a bundle is deployed from a local machine or the workspace, bundle assets are not duplicated.

For requirements for using bundles in the workspace, see [Databricks Asset Bundles in the workspace requirements](/dev-tools/bundles/workspace.md#requirements).

For more information about bundles, see [\_](/dev-tools/bundles/index.md).

## <a id="deploy"></a>Deploy a bundle

To deploy a bundle from the workspace:

1. Navigate to the bundle in the workspace and click a bundle configuration YAML file, such as `databricks.yml`.
1. Click the deployments icon.

1. In the **Deployments** pane, choose a target workspace. Target workspaces are defined in the `targets` mapping of the bundle’s `databricks.yml`. See [\_](/dev-tools/bundles/deployment-modes.md).

   ![Choose target deployment](/images/bundles/target-deployment.png)

1. Click **Deploy**. The bundle is validated and details of the validation appear in a dialog.
1. Review the deployment details in this **Deploy to dev** confirmation dialog, then click **Deploy**.

   ![Deploy to dev dialog](/images/bundles/dev-deploy.png)

   :::important

   Deploying bundles and running bundle resources executes code as the current user. Make sure that you trust the code in the bundle, including YAML, which can contain configuration settings that run commands.

   :::

The status of the deployment is output to the **Project output** window. When the deployment completes, the deployed bundle resources are listed in the **Bundle resources** pane.

### Source-linked deployments

By default, when you deploy a bundle to a development target through the workspace, resources created during deployment reference source files in the workspace instead of their workspace copies. File synchronization to `${workspace.file_path}` is skipped. If you delete a bundle, only the resources defined in the bundle are deleted; the files remain.

To disable this behavior, in your bundle `databricks.yml` configuration file, set the `source_linked_deployment` deployment mode preset to `false`.

:::important

Source-linked deployments are only applicable for :re[DABS] in the workspace. The `source_linked_deployment` preset is ignored if you deploy a bundle using the Databricks CLI `databricks bundle deploy` command.

:::

```yaml
targets:
  # Disable source_linked_deployment in dev
  dev:
    mode: development
    presets:
      source_linked_deployment: false
```

For more information about deployment modes, see [\_](/dev-tools/bundles/deployment-modes.md).

## Run a workflow in a bundle

You can trigger a run of a resource defined in bundle after the bundle has been successfully deployed:

1. Navigate to the bundle in the workspace and click a bundle configuration YAML file, such as `databricks.yml`.
1. Click the deployments icon.

   ![Deployments icon](/images/bundles/deployment-icon.png)

1. In the **Bundle resources** pane, click the run (play) icon associated with any resource to run it.

   ![List deployed resources](/images/bundles/deployed-resources.png)

   If a resource is disabled and does not have a run icon, it has not yet been deployed. Deploy the bundle before attempting to run the resource. See [\_](#deploy).

## <a id="share"></a>Collaborate, review, and deploy to production

:re[DABS] in the workspace allows you to customize permissions to modify, deploy, and run the bundle for easy collaboration and troubleshooting. Databricks recommends collaborating on your bundle through Git, but for simple troubleshooting, you can share a bundle with your collaborators in the Databricks workspace. Navigate to the bundle project view and click **Share**. Bundles inherit the permissions of their parent Git folder, so sharing a bundle applies the changes to the parent Git folder.

When you have finished collaboration and testing of your bundle in **dev**, change the target deployment to **prod** to deploy to the current workspace.

:::note

If a user does not have access to a production workspace they cannot deploy to that workspace. In addition, deploying bundles across different workspaces is not supported when you use the UI to deploy bundles.

:::

Define a different production workspace for your automated deployments in the `databricks.yml` configuration file. See [\_](/dev-tools/bundles/settings.md#workspace).
