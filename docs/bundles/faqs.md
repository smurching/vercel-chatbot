---
description: 'Discover answers to frequently asked questions (FAQ) about Databricks Asset Bundles.'
last_update:
  date: 2025-06-23
---

# :re[DABS] FAQs

This article lists frequently asked questions about :re[DABS].

## Why do I need to have separate development and production target environments?

Separate development and producton environments allow you to:

- Safely isolate development changes so that they don't accidentally impact production.
- Prevent code duplication by customizing resources to apply to a specific target environemnt.
- Streamline and simplify CI/CD with environment-specific configuration, such as database paths, alerting, and access controls.
- Reuse workflows across teams and environments.

Use targets to define bundle deployment environments. See [\_](/dev-tools/bundles/settings.md#targets).

## How do I make my bundles consistent across my organization?

Use bundle templates for consistent structure, to reduce setup errors, and to promote best practices. You can use default bundle templates or you can create your own custom bundle templates. See [\_](/dev-tools/bundles/templates.md).

## There is a lot of repetition across my bundles, such as the same cluster definitions. What is the best way to handle this?

Custom variables are the best way to handle repetitions, as well as settings that are context-specific. See [\_](/dev-tools/bundles/variables.md#custom-variables).

## What are some best practices when using bundles in my deployment flow?

Databricks recommends that you:

- Shift from manual deploys to reliable automation using Git-integrated workflows.
- Validate before deploying a bundle using `databricks bundle validate` in your CI/CD pipeline.
- Separate deploy steps to ensure changes are reviewed and intentional.
- Parameterize environments (dev, staging, prod) with overrides to isolate changes.
- Run integration tests post-deploy to catch issues early.
- Use GitHub Actions, Azure DevOps, or GitLab CI to trigger deploys on commit or PR merge.
- Track what’s deployed, where, and when, so that every deploy maps to a commit and bundle version.

## Can I port existing jobs, pipelines, dashboards and other Databricks objects into my bundle?

Yes. Use the `databricks bundle generate` command to generate a configuration file for an existing job, pipeline, or dashboard in your local bundle, then use `databricks bundle deployment bind` to bind the bundle resource to the corresponding resource in the workspace. This is ideal for onboarding existing workflows into structured, versioned development. Binding also resolves relative paths to absolute workspace references, which avoids path errors.

See [\_](/dev-tools/bundles/migrate-resources.md).

## How do I test my bundle iteratively?

You can develop faster with iterative deploys and runs:

- Validate before deploying
- Deploy incrementally
- Run only what is needed
- Edit and repeat

This accelerates testing and debugging, reduces context switching, enables safer and faster iteration without full redeploys, and enforces discipline as you move toward production.
