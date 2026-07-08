# Pushing step 1 through the GitHub website (no git needed)

## 1. Create the branch
Go to https://github.com/Sikatu/power-within-movement-react
Click the branch dropdown (currently showing "main") → type
`design/elevated-editorial-redesign` → click "Create branch: ... from main".
Make sure you're switched to this new branch for every step below.

## 2. Add the 6 new design-handoff files
Unzip `new-files-for-github-upload.zip` — it contains one folder,
`design_handoff_power_within_elevated/`, with the right structure already:
```
design_handoff_power_within_elevated/
  README.md
  KICKOFF_PROMPT.md
  Client Portal - Polished.dc.html
  support.js
  site/
    index.dc.html
    support.js
```
On the branch, go to **Add file → Upload files**, then drag the whole
`design_handoff_power_within_elevated` folder onto the drop zone. GitHub
preserves folder structure when you drag a folder in Chrome/Edge/Firefox.
Commit directly to `design/elevated-editorial-redesign`.

(If your browser doesn't support folder drag-and-drop, create each path
manually with "Add file → Create new file", type the path e.g.
`design_handoff_power_within_elevated/site/index.dc.html` in the filename
box — GitHub auto-creates the folders — then paste the file's contents.)

## 3. Replace the 4 modified files
Still on `design/elevated-editorial-redesign`, for each file below: open it,
click the pencil (✏️) icon, select all (Ctrl/Cmd+A) in the editor, delete,
and paste in the matching `.txt` file's contents exactly. Commit each
directly to the branch.

| Repo file | Paste from |
|---|---|
| `index.html` | `index.html.txt` |
| `src/components/Navbar.jsx` | `Navbar.jsx.txt` |
| `src/components/Footer.jsx` | `Footer.jsx.txt` |
| `src/styles/global.css` | **don't replace the whole file** — scroll to the very last line and paste `global.css.APPEND_AT_END.txt` right after it |

## 4. Open the PR
Once all 10 files are committed to the branch, GitHub will show a banner
to open a pull request from `design/elevated-editorial-redesign` into `main`.
That's it — step 1 is live for review.
