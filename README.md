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
        repo: deckhouse/deckhouse

    - name: Write Changelog YAML
      id: yaml_file
      shell: bash
      run: |
        mkdir -p ./CHANGELOG
        filename='./CHANGELOG/CHANGELOG-${{ steps.args.outputs.milestone_title }}.yml'
        cat > "$filename" <<EOF
        ${{ steps.changelog.outputs.patch_yaml }}
        EOF

    - name: Write Changelog Markdown
      id: md_file
      shell: bash
      run: |
        filename='./CHANGELOG/CHANGELOG-${{ steps.changelog.outputs.minor_version }}.md'
        cat > "$filename" <<EOF
        ${{ steps.changelog.outputs.minor_markdown }}
        EOF

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
 - **[cloud-provider-yandex]** d00029 [#291](https://github.com/ow/re/291)
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
 - **[cloud-provider-yandex]** d00029 [#291](https://github.com/ow/re/291)
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
