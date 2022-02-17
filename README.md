# Changelog Action

This action creates changelogs by merged PRs per milestone.

## How to use

```yaml
    # Assume there is 'args' step which decides on milestone, so that
    #   steps.args.outputs.milestone_title  = "v1.2.3"
    #   steps.args.outputs.milestone_number = 42

    - name: Collect Changelog
      id: changelog
      uses: deckhouse/changelog-action@v2
      with:
        token: ${{ inputs.token }}
        milestone: ${{ steps.args.outputs.milestone_title }}
        repo: ${{ github.repository }}
        # section:forced_impact_level
        allowed_sections: |
          ci:low
          tests:low
          tools:low
          api
          db
          docs

    # Patch release changelog in YAML
    - name: Write Changelog YAML
      id: yaml_file
      shell: bash
      run: |
        mkdir -p ./CHANGELOG
        filename='./CHANGELOG/CHANGELOG-${{ steps.args.outputs.milestone_title }}.yml'
        cat > "$filename" <<EOF
        ${{ steps.changelog.outputs.release_yaml }}
        EOF

    # Cumulative changelog for release branch in markdown
    - name: Write Changelog Markdown
      id: md_file
      shell: bash
      run: |
        filename='./CHANGELOG/CHANGELOG-${{ steps.changelog.outputs.minor_version }}.md'
        cat > "$filename" <<EOF
        ${{ steps.changelog.outputs.branch_markdown }}
        EOF

    # Patch-version markdown changelog + malformed and impact digest
    - name: Create Pull Request
      uses: peter-evans/create-pull-request@v3.10.1
      with:
        commit-message: Re-generate changelog
        base: main
        branch: changelog/${{ steps.args.outputs.milestone_title }}
        milestone: ${{ steps.args.outputs.milestone_number }}
        title: Changelog ${{ steps.args.outputs.milestone_title }}
        body: ${{ steps.changelog.outputs.release_markdown }}
        labels: changelog, auto
        token: ${{ inputs.token }}
        delete-branch: true
```

## Usage


### Using The Action


```yaml
    - name: Collect Changelog
      id: changelog
      uses: deckhouse/changelog-action@v2
      with:
        token: ${{ inputs.token }}
        milestone: ${{ steps.args.outputs.milestone_title }}
        repo: ${{ github.repository }}
        allowed_sections: |
          one
          two:low
```

### Describing Changes

To be mentioned in changelog, a pull request body must contain `changes` block:

~~~
```changes
section: <kebab-case of a modules/*> | <1st level dir in the repo>
type: fix | feature
summary: <what effectively changes in a single line>
impact_level: low | high*
impact: <what to expect, possibly multi-line>, required if impact_level is high
```
~~~

# How to add to changelog

The "changes" block contains a list of YAML documents. It describes a changelog entry that is automatically collected
in a release changelog PR. It helps tracking changes, writing release messages, and shipping the changes to clusters!


## Block example

````
```changes
section: cloud-provider-aws
type: feature
summary: "Node restarts can be avoided by pinning a checksum to a node group in config values."
impact: Recommended to use as a last resort.
---
section: node-manager
type: fix
summary: "Nodes with outdated manifests are no longer provisioned on *InstanceClass update."
impact_level: high
impact: |
  Expect nodes of "Cloud" type to restart.

  Node checksum calculation is fixes as well as a race condition during
  the machines (MCM) rendering which caused outdated nodes to spawn.
---
section: ci
type: fix
summary: "Improved comments tracking workflow progress"
impact_level: low
```
````


## Fields

### `section`

Required.

Affected part of the codebase or product, how you define it for release notes.

Examples:

  - "docs"
  - "tests"
  - "tools"
  - "api"
  - "ci"

### `type`

Required. "fix" or "feature"

### `summary`

Required.

The changelog summary line. Single sentence that outlines the change. Better not to use line breaks here.

Examples:

-  "Fixed exaggerated values of resource recommendations"
-  "Added support for Digital Ocean cloud provider"

### `impact`

Required if `impact_level` is "high", optional otherwise.

Contains any notable detail about the influence, e.g. expected restarts, downtime, config changes, migrations, etc. It's fine to contain multiple lines of text here. Also, it can contain just a uselful note, depending on the impact level.

Examples assuming impact level is high:

- "Ingress controller will restart" (assuming impact level is high)
- "Expect slow downtime due to kube-apiserver restarts" (assuming impact level is high)

Example of a friendly hint for a reader:

- "Update windows are limited to the range of a single day"

### `impact_level`

Optional.

Can be set to "low" or "high".

`high` means the impact will be copied "Release digest" section; hence the impact field is required. It helps creating important things for release messages.

`low` will be omitted in PR body and release branch changelog. It just denotes that the change is not interesting for end user, e.g. "ci"

Unset value just does not imply adding the impact to Release digest section or omitting the change in YAML



~~~
```changes
section: yyy
type: ""
summary: dm2
impact_level: high
---
section: cloud-provider-yandex
type: fix
summary: d21
impact_level: high
impact: |-
  Grafana will be restarted.
  Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
  Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.
---
section: chrony
type: feature
summary: d12
---
section: cloud-provider-yandex
type: feature
summary: d22
---
section: chrony
type: fix
summary: d11
---
section: xxx
type: fix | feature
summary: dm1
---
section: kube-dns
type: fix
summary: d48
---
section: cloud-provider-yandex
type: fix
summary: d29
---
section: cloud-provider-yandex
type: fix
summary: d00029
impact_level: low
---
section: kube-dns
type: feature
summary: widlcard domains support
impact: So good.
impact_level: high
---
section: kube-dns
type: feature
summary: impact missing
impact_level: high
```
~~~

### Output

The action generates changelog in YAML and markdown.

#### Markdown output

```markdown
# Changelog v3.44.555

## [MALFORMED]


 - #495 missing high impact detail
 - #510 invalid type "fix | feature"
 - #533 missing high impact detail, missing type

## Release digest


 - Grafana will be restarted.
    Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
    Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.
 - So good.

## Features


 - **[chrony]** d12 [#120](https://github.com/ow/re/120)
 - **[cloud-provider-yandex]** d22 [#220](https://github.com/ow/re/220)
 - **[kube-dns]** widlcard domains support [#491](https://github.com/ow/re/491)
    So good.

## Fixes


 - **[chrony]** d11 [#110](https://github.com/ow/re/110)
 - **[cloud-provider-yandex]** d21 [#210](https://github.com/ow/re/210)
    Grafana will be restarted.
    Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
    Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.
 - **[cloud-provider-yandex]** d29 [#290](https://github.com/ow/re/290)
 - **[kube-dns]** d48 [#480](https://github.com/ow/re/480)

```

<details>
  <summary>Markdown Preview</summary>

# Changelog v3.44.555

## [MALFORMED]


 - #495 missing high impact detail
 - #510 invalid type "fix | feature"
 - #533 missing high impact detail, missing type

## Release digest


 - Grafana will be restarted.
    Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
    Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.
 - So good.

## Features


 - **[chrony]** d12 [#120](https://github.com/ow/re/120)
 - **[cloud-provider-yandex]** d22 [#220](https://github.com/ow/re/220)
 - **[kube-dns]** widlcard domains support [#491](https://github.com/ow/re/491)
    So good.

## Fixes


 - **[chrony]** d11 [#110](https://github.com/ow/re/110)
 - **[cloud-provider-yandex]** d21 [#210](https://github.com/ow/re/210)
    Grafana will be restarted.
    Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
    Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.
 - **[cloud-provider-yandex]** d29 [#290](https://github.com/ow/re/290)
 - **[kube-dns]** d48 [#480](https://github.com/ow/re/480)

</details>



#### YAML output

```yaml
chrony:
  features:
    - summary: d12
      pull_request: https://github.com/ow/re/120
  fixes:
    - summary: d11
      pull_request: https://github.com/ow/re/110
cloud-provider-yandex:
  features:
    - summary: d22
      pull_request: https://github.com/ow/re/220
  fixes:
    - summary: d21
      pull_request: https://github.com/ow/re/210
      impact: >-
        Grafana will be restarted.

        Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached),
        because direct(browse) datasources type is depreated now. And alerts don't work with direct
        data sources.

        Provisioning datasources from secret instead configmap. Deckhouse datasources need client
        certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while
        terminating.
    - summary: d29
      pull_request: https://github.com/ow/re/290
kube-dns:
  features:
    - summary: widlcard domains support
      pull_request: https://github.com/ow/re/491
      impact: So good.
  fixes:
    - summary: d48
      pull_request: https://github.com/ow/re/480
```


## License

Apache License Version 2.0
