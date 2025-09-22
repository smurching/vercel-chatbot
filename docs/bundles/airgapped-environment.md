---
description: 'Learn how to set up :re[DABS] to work in an air-gapped environment.'
last_update:
  date: 2024-04-22
---

# Set up :re[DABS] to work in an air-gapped environment

:re[DABS] depend on external libraries and tools to function properly. The locations (URLs) of these dependencies need to be accessible or bundle initialization fails. Because of this, before using :re[DABS] in an air-gapped network environment that does not have access to the Internet, you need to download the Docker container image provided by the Databricks CLI and manage your :re[DABS] through Docker.

### Download the Docker container image

The Databricks CLI Docker container image supports ARM64 and AMD64 CPU architectures, and is available in the [Databricks CLI GitHub repository](https://github.com/databricks/cli/pkgs/container/cli). You can download the latest available image by running the following command:

```bash
docker pull ghcr.io/databricks/cli:latest
```

If you want to download an image associated with a certain Databricks CLI version, specify the version as shown below:

```bash
docker pull ghcr.io/databricks/cli:v0.218.0
```

### Manage your :re[DABS] through Docker

Once you have downloaded the appropriate Docker container, you can use the Docker CLI to execute `databricks bundle` commands, either directly or interactively.

#### Direct execution

To directly execute `bundle` commands, use `docker run`. For example, the following command deploys the bundle located at `/my-bundle`:

```sh
docker run -v /my-bundle:/my-bundle -e DATABRICKS_HOST=... -e DATABRICKS_TOKEN=... --workdir /my-bundle ghcr.io/databricks/cli:latest bundle deploy
```

In the example above, `-v /my-bundle:/my-bundle` mounts `my-bundle` into the Docker container's file system using the same bundle name, `-e DATABRICKS_HOST=... -e DATABRICKS_TOKEN=...` authenticates the Databricks CLI by passing host and credentials as environment variables, and `--workdir /my-bundle ghcr.io/databricks/cli:latest` sets the current working directory to `/my-bundle`. Additional `docker run` command options can be found in the [Docker Documentation](https://docs.docker.com/reference/cli/docker/container/run).

#### Interactive execution

To interactively execute `bundle` commands, start by using `docker run` with the `-it` and `--entrypoint` options to launch an integrated `sh` terminal session that is attached to the container, as shown below:

```bash
docker run -v /my-bundle:/my-bundle -e DATABRICKS_HOST=... -e DATABRICKS_TOKEN=... -it --entrypoint /bin/sh --workdir /my-bundle ghcr.io/databricks/cli:latest
```

When the Docker terminal session starts, you can execute `bundle` commands directly in the terminal. The following example deploys the bundle named `my-bundle`:

```
/my-bundle # databricks bundle deploy
```

The volume mounts sync bidirectionally so you can make changes to your bundle locally and then use this Docker terminal session to execute `bundle` commands. In this case you do not need to execute `docker run` again.
