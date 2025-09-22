---
description: 'Learn how to configure authentication for :re[DABS].'
last_update:
  date: 2024-09-19
---

# Authentication for :re[DABS]

This article describes how to configure authentication for :re[DABS]. See [\_](/dev-tools/bundles/index.md).

You deploy and run :re[DABS] within the context of two types of authentication scenarios: _attended_ and _unattended_:

- Attended authentication scenarios (user-to-machine) are manual workflows, for example, using your web browser on your local machine to log in to your target :re[Databricks] workspace when prompted by the Databricks CLI. This method is ideal for experimenting or for rapid development.
- Unattended authentication scenarios (machine-to-machine) are fully automated CI/CD workflows, for example, when using CI/CD systems such as GitHub.

The following sections recommend the :re[Databricks] authentication types and settings to use for :re[DABS], based on these two types of authentication scenarios.

## Attended authentication

For attended authentication scenarios with :re[DABS], Databricks recommends that you use [OAuth user-to-machine (U2M) authentication](#u2m) for your :re[Databricks] user account in the target workspace.

You can also use a [personal access token](#pat) associated with your :re[Databricks] user account for the target workspace.

:::aws

::include[basic-auth-deprecation.md]

:::

For more information about these :re[Databricks] authentication types, see [\_](/dev-tools/auth/index.md#auth-types).

For storing authentication settings for attended authentication scenarios, Databricks recommends that you use :re[Databricks] configuration profiles on your local development machine. Configuration profiles enable you to quickly switch among different :re[Databricks] authentication contexts to do rapid local development among multiple :re[Databricks] workspaces. With profiles, you can use the `--profile` or `-p` options to specify a particular profile when running the bundle `validate`, `deploy`, `run`, and `destroy` commands with the Databricks CLI. See [\_](/dev-tools/auth/config-profiles.md).

:::note

If it exists, the `DEFAULT` configuration profile is used when the command-line option `-p <profile-name>` or the `profile` (or `host`) mapping is not specified.

:::

Databricks also supports the use of the `profile` mapping within the [workspace](/dev-tools/bundles/settings.md#bundle-syntax-mappings-workspace) mapping to specify the profile to use for each target workspace in your bundle configuration files. However, hard-coded mappings make your bundle configuration files less reusable across projects.

## Unattended authentication

For unattended authentication scenarios with :re[DABS], Databricks recommends that you use the following :re[Databricks] authentication types, in the following order of preference:

:::aws

- [\_](#m2m) for a :re[service-principal] in the target workspace.
- [\_](#pat) for a token that is associated with a :re[service-principal] in the target workspace.

:::

:::azure

- [\_](#azure-mi) with an Azure managed identity registered with an Azure virtual machine, if this setup is supported by your CI/CD system.
- [\_](#m2m) for a :re[databricks-service-principal] in the target workspace.
- [\_](#azure-sp) for a :re[entra-managed-service-principal] in the target workspace.

:::

:::gcp

- [\_](#m2m) for a :re[service-principal] in the target workspace.
- [\_](#gcp-id) for a :re[GCP] service account acting as a :re[Databricks] user in the target workspace.
- [\_](#pat) for a token that is associated with a :re[service-principal] in the target workspace.

:::

For more information about these :re[Databricks] authentication types, see [\_](/dev-tools/auth/index.md#auth-types).

For unattended authentication scenarios, Databricks recommends using environment variables to store :re[Databricks] authentication settings in your target CI/CD system, because CI/CD systems are typically optimized for this.

For :re[DABS] projects used in CI/CD systems designed to work with multiple :re[Databricks] workspaces (for example, three separate but related development, staging, and production workspaces), :re[Databricks] recommends that you use service principals for authentication and that you give one service principal access to all participating workspaces. This enables you to use the same environment variables across all of the project's workspaces.

Databricks also supports the use of hard-coded, authentication-related settings in the [workspace](/dev-tools/bundles/settings.md#bundle-syntax-mappings-workspace) mapping for target workspaces in your bundle configuration files. However, hard-coded settings make your bundles configuration less reusable across projects and risk exposing sensitive information such as :re[service-principal] IDs.

For unattended authentication scenarios, you must also install the Databricks CLI on the associated compute resources, as follows:

- For manual installation, see [\_](/dev-tools/cli/install.md).
- For GitHub, see [\_](/dev-tools/bundles/ci-cd-bundles.md).
- For other CI/CD systems, see [\_](/dev-tools/cli/install.md) and your CI/CD system provider's documentation.

:::azure

## <a id="azure-mi"></a>Azure managed identities authentication

To set up Azure managed identities authentication, see [\_](/dev-tools/auth/azure-mi.md).

The list of environment variables to set for unattended authentication is in the workspace-level operations coverage in the “Environment” section of [\_](/dev-tools/auth/azure-mi.md). To set environment variables, see the documentation for your operating system or CI/CD system provider.

:::

## <a id="m2m"></a>OAuth machine-to-machine (M2M) authentication

To set up OAuth M2M authentication, see [\_](/dev-tools/auth/oauth-m2m.md).

The list of environment variables to set for unattended authentication is in the workspace-level operations coverage of the “Environment” section of [\_](/dev-tools/auth/oauth-m2m.md). To set environment variables, see the documentation for your operating system or CI/CD system provider.

:::azure

## <a id="azure-sp"></a>:re[entra-service-principal] authentication

To set up :re[entra-service-principal] authentication, see [\_](/dev-tools/auth/azure-sp.md).

The list of environment variables to set for unattended authentication is in the workspace-level operations coverage in the “Environment” section of [\_](/dev-tools/auth/azure-sp.md). To set environment variables, see the documentation for your operating system or CI/CD system provider.

## <a id="azure-cli"></a>Azure CLI authentication

To set up Azure CLI authentication, see [\_](/dev-tools/auth/azure-cli.md).

For attended authentication scenarios, to create :re[a Databricks] configuration profile, see the “Profile” section in [\_](/dev-tools/auth/azure-cli.md).

:::

## <a id="u2m"></a>OAuth user-to-machine (U2M) authentication

To set up OAuth U2M authentication, see the “CLI” section in [\_](/dev-tools/auth/oauth-u2m.md).

For attended authentication scenarios, completing the instructions in the “CLI” section of [\_](/dev-tools/auth/oauth-u2m.md) automatically creates :re[a Databricks] configuration profile for you.

:::gcp

## <a id="gcp-id"></a>:re[GCP] ID authentication

To set up :re[GCP] ID authentication, see [\_](/dev-tools/auth/gcp-id.md).

The list of environment variables to set for unattended authentication is in the workspace-level operations coverage in the “Environment” section of [\_](/dev-tools/auth/gcp-id.md). To set environment variables, see the documentation for your operating system or CI/CD system provider.

:::

## <a id="pat"></a>:re[Databricks] personal access token authentication

To create :re[a Databricks] personal access token, see [\_](/dev-tools/auth/pat.md).

For attended authentication scenarios, to create :re[a Databricks] configuration profile, see the “CLI” section in [\_](/dev-tools/auth/pat.md).

The list of environment variables to set for unattended authentication is in the workspace-level operations coverage in the “Environment” section of [\_](/dev-tools/auth/pat.md). To set environment variables, see the documentation for your operating system or CI/CD system provider.
