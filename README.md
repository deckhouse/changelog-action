# Changelog Action

This action creates changelogs by merged PRs per milestone.

## How to use

```yaml
    # Assume there is 'args' step which decides on milestone, so that
    #   steps.args.outputs.milestone_title  = "v1.2.3"
    #   steps.args.outputs.milestone_number = 42

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

    - name: Write Changelog File
      id: file
      shell: bash
      run: |
        mkdir -p ./CHANGELOG
        filename='./CHANGELOG/CHANGELOG-${{ steps.args.outputs.milestone_title }}.yml'
        cat > "$filename" <<EOBODYINACTION
        ${{ steps.changelog.outputs.yaml }}
        EOBODYINACTION

    - name: Create Pull Request
      uses: peter-evans/create-pull-request@v3.10.1
      with:
        commit-message: Re-generate changelog
        base: main
        branch: changelog/${{ steps.args.outputs.milestone_title }}
        milestone: ${{ steps.args.outputs.milestone_number }}
        title: Changelog ${{ steps.args.outputs.milestone_title }}
        body: ${{ steps.changelog.outputs.markdown }}
        labels: changelog, auto
        token: ${{ inputs.token }}
        delete-branch: true
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

- **`module`**: (Required.) Affected module, used for fist-level grouping.
- **`type`**: (Required.) The change type: only `fix` and `feature` supported. Used for second-level
  grouping.
- **`description`**: (Optional.) The changelog entry. Omit to use pull request title.
- **`note`**: (Optional.) Any notable detail, e.g. expected restarts, downtime, config changes, migrations, etc.

`changes` block expects a list of YAML documents. Each document describes a changelog entry. These
changes are collected and grouped by the action. The changes are grouped by module and then by type
within a module.

Since the syntax is YAML, field values can contain multi-line text which might be useful for `note`. The
result of the action is YAML and Markdown texts, which can be used to create file and changelog pull
request body respectively.

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

The action generates changelog in YAML and markdown.

#### Markdown output

```markdown

## Changelog v1.39.0

#### [cloud-provider-aws]

 - features
     - Node restarts can be avoided by pinning a checksum to a node group in config values.
         - [Pull request](https://github.com/owner/repo/pull/1)
         - Recommended to use as a last resort.

#### [node-manager]

 - fixes
     - Nodes with outdated manifests are no longer provisioned on *InstanceClass update.
         - [Pull request](https://github.com/owner/repo/pull/1)
         - Expect nodes of "Cloud" type to restart.
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
         - Recommended to use as a last resort.

#### [node-manager]

 - fixes
     - Nodes with outdated manifests are no longer provisioned on *InstanceClass update.
         - [Pull request](https://github.com/owner/repo/pull/1)
         - Expect nodes of "Cloud" type to restart.
            Node checksum calculation is fixed as well as a race condition during
            the machines (MCM) rendering which caused outdated nodes to spawn.

</details>



#### YAML output

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
