# Applying step 1 of the redesign (power-within-step1.bundle)

This bundle contains `main` plus the new branch `design/elevated-editorial-redesign`
(1 commit: fonts, design tokens, Nav, Footer) on top of it.

## Option A — pull the branch into your existing local clone

```
cd power-within-movement-react
git fetch /path/to/power-within-step1.bundle design/elevated-editorial-redesign:design/elevated-editorial-redesign
git push -u origin design/elevated-editorial-redesign
```

## Option B — clone straight from the bundle (if you don't have a local clone yet)

```
git clone power-within-step1.bundle power-within-movement-react
cd power-within-movement-react
git remote set-url origin https://github.com/Sikatu/power-within-movement-react.git
git checkout design/elevated-editorial-redesign
git push -u origin design/elevated-editorial-redesign
```

After that, open a PR from `design/elevated-editorial-redesign` into `main` whenever
you're ready (or I can open it once the GitHub App has write access).

`power-within-step1.diff` is included alongside for a quick human-readable look at
the change without needing git.
