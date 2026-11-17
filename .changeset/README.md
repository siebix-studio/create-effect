# Changesets

Every pull request that changes what `@siebix/create-effect` users get adds a changeset:

```sh
bun changeset
```

Pick the bump (patch, minor or major) and describe the change in a sentence written for users. The file lands in this folder and is committed with the pull request. See "Releasing" in the root README for what happens after the merge.
