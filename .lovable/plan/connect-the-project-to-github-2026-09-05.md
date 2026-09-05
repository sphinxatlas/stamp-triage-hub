# Connect the project to GitHub

This is a one-time setup you do in the Lovable interface — no code changes are needed, and nothing in the stamp triage tool will change.

## Steps

1. In the chat input, open the Plus (+) menu at the bottom left.
2. Choose GitHub, then Connect project.
3. Authorize the Lovable GitHub App for the sphinxatlas account.
4. Pick sphinxatlas as the destination account and click Create Repository.

Lovable creates a fresh repository there (name it stampdex-lovable, or anything free — the existing stampdex repo can't be reused directly) and turns on two-way syncing: changes made here appear in GitHub, and pushes to GitHub come back here automatically.

## Notes

- Only one GitHub account can be linked per Lovable account.
- If you want the code inside the existing sphinxatlas/stampdex repo, clone the new repo locally afterwards and push its contents there yourself.
- Database contents are not part of the repository; they stay in the project's backend.
