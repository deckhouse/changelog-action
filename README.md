# Changelog Action

This action creates changelogs by merged PRs per milestone.


## Usage


### Action

The action takes JSON array or pull requests. Pull requests objects are expected to have fields
`number`, `url`, `title`, `body`, `state`, and `milestone`. All the pull requests in the array must
share the same milestone.

Change `@main` branch reference to a tag of your choice.

```yaml
    - name: Collect Changelog
      id: changelog
      uses: deckhouse/changelog-action@v1
      with:
        token: ${{ gtihub access token }}
        pull_requests: ${{ Pull requests JSON }}
```

### Pull requests

To be mentioned in changelog, pull request body must contain `changes` block:

~~~
```changes
module: <name>
type: fix | feature
description: <what effectively changes>
note: <what to expect>
```
~~~

`changes` block contains a list of YAML documents. It describes a changelog entry that is collected
to a release changelog.

Fields:

- **`module`**: Required. Affected module in kebab case, e.g. "node-manager".
- **`type`**: Required. The change type: only "fix" and "feature" supported.
- **`description`**: Optional. The changelog entry. Omit to use pull request title.
- **`note`**: Optional. Any notable detail, e.g. expected restarts, downtime, config changes, migrations, etc.

Since the syntax is YAML, `note` may contain multi-line text.

There can be multiple docs in single `changes` block, and multiple `changes`
blocks in the PR body.

Consider this example. Let's say, this PR belongs to milestone `v1.39.0`


```changes
module: node-manager
type: fix
description: "Nodes with outdated manifests are no longer provisioned on *InstanceClass update."
note: |
  Expect nodes of "Cloud" type to restart.

  Node checksum calculation is fixed as well as a race condition during
  the machines (MCM) rendering which caused outdated nodes to spawn.
---
module: cloud-provider-aws
type: feature
description: "Node restarts can be avoided by pinning a checksum to a node group in config values."
note: Recommended to use as a last resort.
```

### Generated pull request body


```markdown

## Changelog v1.39.0

#### [cloud-provider-aws]

 - features
     - Node restarts can be avoided by pinning a checksum to a node group in config values.
         - [Pull request](https://github.com/owner/repo/pull/1)
         - **NOTE!** Recommended to use as a last resort.

#### [node-manager]

 - fixes
     - Nodes with outdated manifests are no longer provisioned on *InstanceClass update.
         - [Pull request](https://github.com/owner/repo/pull/1)
         - **NOTE!** Expect nodes of "Cloud" type to restart.
            Node checksum calculation is fixed as well as a race condition during
            the machines (MCM) rendering which caused outdated nodes to spawn.

```

<details>
  <summary>Preview</summary>

## Changelog v1.39.0

#### [cloud-provider-aws]

 - features
     - Node restarts can be avoided by pinning a checksum to a node group in config values.
         - [Pull request](https://github.com/owner/repo/pull/1)
         - **NOTE!** Recommended to use as a last resort.

#### [node-manager]

 - fixes
     - Nodes with outdated manifests are no longer provisioned on *InstanceClass update.
         - [Pull request](https://github.com/owner/repo/pull/1)
         - **NOTE!** Expect nodes of "Cloud" type to restart.
            Node checksum calculation is fixed as well as a race condition during
            the machines (MCM) rendering which caused outdated nodes to spawn.

</details>



#### Generated changelog file in pull request

```yaml
cloud-provider-aws:
  features:
    - description: Node restarts can be avoided by pinning a checksum to a node group in config values.
      note: Recommended to use as a last resort.
      pull_request: https://github.com/owner/repo/pull/1
node-manager:
  fixes:
    - description: Nodes with outdated manifests are no longer provisioned on *InstanceClass update.
      note: |-
        Expect nodes of "Cloud" type to restart.
        Node checksum calculation is fixed as well as a race condition during
        the machines (MCM) rendering which caused outdated nodes to spawn.
      pull_request: https://github.com/owner/repo/pull/1
```

## Example

```yaml
    - name: Find Merged Pull Requsts
      id: merged_milestone
      shell: bash
      env:
        GITHUB_TOKEN: ${{ inputs.token }}
      run: |
        prs="$(gh pr list \
          --repo '${{ github.repository }}' \
          --search 'milestone:${{ steps.args.outputs.milestone_title }}' \
          --state merged \
          --json number,url,title,body,state,milestone)"
        echo "::set-output name=prs::${prs}"

    - name: Collect Changelog
      id: changelog
      uses: deckhouse/changelog-action@v1
      with:
        token: ${{ inputs.token }}
        pull_requests: ${{ steps.merged_milestone.outputs.prs }}
```

## License

Apache License Version 2.0