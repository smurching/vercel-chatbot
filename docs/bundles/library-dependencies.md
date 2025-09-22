---
description: 'Learn about adding library dependencies to your :re[DABS].'
last_update:
  date: 2025-05-05
---

# :re[DABS] library dependencies

This article describes the syntax for declaring :re[DABS] library dependencies. Bundles enable programmatic management of Lakeflow Jobs. See [\_](/dev-tools/bundles/index.md).

In addition to notebooks and source files, your jobs will likely depend on libraries in order to work as expected. Library dependencies are declared in your [bundle configuration files](/dev-tools/bundles/settings.md) and are often necessary as part of the [job task type](/dev-tools/bundles/job-task-types.md) specification.

Bundles provide support for the following library dependencies:

- Python wheel file
- JAR file (Java or Scala)
- PyPI, Maven, or CRAN packages

For Python, you can also specify job task dependencies in a `requirements.txt` file and include that in your bundle. See [\_](#requirementstxt).

:::note

Whether a library is supported depends on the cluster configuration and the library source. For complete library support information, see [\_](/libraries/index.md).

:::

## Python wheel file

To add a Python wheel file to a job task, in `libraries` specify a `whl` mapping for each library to be installed. You can install a wheel file from workspace files, :re[UC] volumes, cloud object storage, or a local file path.

::include[warnings/dbfs-library.md]

The following example shows how to install three Python wheel files for a job task.

- The first Python wheel file was either previously uploaded to the :re[Databricks] workspace or added as an `include` item in the `sync` [mapping](/dev-tools/bundles/settings.md#sync), and is in the same local folder as the bundle configuration file.
- The second Python wheel file is in the specified workspace files location in the :re[Databricks] workspace.
- The third Python wheel file was previously uploaded to the volume named `my-volume` in the :re[Databricks] workspace.

```yaml
resources:
  jobs:
    my_job:
      # ...
      tasks:
        - task_key: my_task
          # ...
          libraries:
            - whl: ./my-wheel-0.1.0.whl
            - whl: /Workspace/Shared/Libraries/my-wheel-0.0.1-py3-none-any.whl
            - whl: /Volumes/main/default/my-volume/my-wheel-0.1.0.whl
```

## JAR file (Java or Scala)

To add a JAR file to a job task, in `libraries` specify a `jar` mapping for each library to be installed. You can install a JAR from :re[UC] volumes, cloud object storage, or a local file path.

::include[warnings/dbfs-library.md]

The following example shows how to install a JAR file that was previously uploaded to the volume named `my-volume` in the :re[Databricks] workspace.

```yaml
resources:
  jobs:
    my_job:
      # ...
      tasks:
        - task_key: my_task
          # ...
          libraries:
            - jar: /Volumes/main/default/my-volume/my-java-library-1.0.jar
```

For example configuration that builds and deploys the JAR, see [\_](/dev-tools/bundles/examples.md#jar-upload). For a tutorial that creates a bundle project that builds and deploys a Scala JAR, see [\_](/dev-tools/bundles/scala-jar.md).

## PyPI package

To add a PyPI package to a job task definition, in `libraries`, specify a `pypi` mapping for each PyPI package to be installed. For each mapping, specify the following:

- For `package`, specify the name of the PyPI package to install. An optional exact version specification is also supported.
- Optionally, for `repo`, specify the repository where the PyPI package can be found. If not specified, the default `pip` index is used ([https://pypi.org/simple/](https://pypi.org/simple)).

The following example shows how to install two PyPI packages.

- The first PyPI package uses the specified package version and the default `pip` index.
- The second PyPI package uses the specified package version and the explicitly specified `pip` index.

```yaml
resources:
  jobs:
    my_job:
      # ...
      tasks:
        - task_key: my_task
          # ...
          libraries:
            - pypi:
                package: wheel==0.41.2
            - pypi:
                package: numpy==1.25.2
                repo: https://pypi.org/simple/
```

## Maven package

To add a Maven package to a job task definition, in `libraries`, specify a `maven` mapping for each Maven package to be installed. For each mapping, specify the following:

- For `coordinates`, specify the Gradle-style Maven coordinates for the package.
- Optionally, for `repo`, specify the Maven repo to install the Maven package from. If omitted, both the Maven Central Repository and the Spark Packages Repository are searched.
- Optionally, for `exclusions`, specify any dependencies to explicitly exclude. See [Maven dependency exclusions](https://maven.apache.org/guides/introduction/introduction-to-optional-and-excludes-dependencies.html).

The following example shows how to install two Maven packages.

- The first Maven package uses the specified package coordinates and searches for this package in both the Maven Central Repository and the Spark Packages Repository.
- The second Maven package uses the specified package coordinates, searches for this package only in the Maven Central Repository, and does not include any of this package's dependencies that match the specified pattern.

```yaml
resources:
  jobs:
    my_job:
      # ...
      tasks:
        - task_key: my_task
          # ...
          libraries:
            - maven:
                coordinates: com.databricks:databricks-sdk-java:0.8.1
            - maven:
                coordinates: com.databricks:databricks-dbutils-scala_2.13:0.1.4
                repo: https://mvnrepository.com/
                exclusions:
                  - org.scala-lang:scala-library:2.13.0-RC*
```

## <a id="requirementstxt"></a>Python requirements.txt

Python library dependencies can also be specified in a `requirements*.txt` file that is included as part of the job task definition. The path to the file can be a local path, a workspace path, or :re[UC] volume path.

```yaml
resources:
  jobs:
    my_job:
      # ...
      tasks:
        - task_key: my_task
          # ...
          libraries:
            - requirements: ./local/path/requirements.txt
```
