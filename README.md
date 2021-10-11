# Changelog Action

This action creates changelogs by merged PRs per milestone.


## Usage

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