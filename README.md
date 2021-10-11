# Changelog Action

This action creates changelogs by merged PRs per milestone.

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
          --search 'milestone:${{ steps.xxx.outputs.milestone_title }}' \
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

## Usage


### Using The Action

The action takes JSON array or pull requests. Pull requests objects are expected to have fields
`number`, `url`, `title`, `body`, `state`, and `milestone`. All the pull requests in the array must
share the same milestone.

```yaml
    - name: Collect Changelog
      id: changelog
      uses: deckhouse/changelog-action@v1
      with:
        token: ${{ Github access token }}
        pull_requests: ${{ Pull requests JSON }}
```

### Describing Changes

To be mentioned in changelog, a pull request body must contain `changes` block:

~~~
```changes
module: <name>
type: fix | feature
description: <what effectively changes>
note: <what to expect>
```
~~~

Fields:

- **`module`**: Required. Affected module in kebab case, e.g. "node-manager".
- **`type`**: Required. The change type: only "fix" and "feature" supported.
- **`description`**: Optional. The changelog entry. Omit to use pull request title.
- **`note`**: Optional. Any notable detail, e.g. expected restarts, downtime, config changes, migrations, etc.

`changes` block contains a list of YAML documents. It describes a changelog entries (one per doc)
that are collected into a release changelog. The changes are grouped by module and then by type
within a module. Since the syntax is YAML, fields values can contain multi-line text which us usefulr for `note`.

There can be multiple docs in single `changes` block, and/or multiple `changes`
blocks in PR body.

Consider this example. Let's say, a PR belongs to milestone `v1.39.0` and describes these changes:

~~~
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
~~~

### Output

The action generates pull request with the changelog in its body (markdown) and its content in file `CHANGELOG/CHANGELOG-v1.39.0.yml`.

#### Pull request body

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
  <summary>Markdown Preview</summary>

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


## License

Apache License Version 2.0