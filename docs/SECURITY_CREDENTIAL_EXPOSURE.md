# Credential exposure response

`localhost_data.json` was previously tracked and contained user records and
bcrypt password hashes. The file is now ignored and removed from the current
Git index, but that does not remove it from existing clones or Git history.

Required repository-owner actions:

1. Confirm whether the snapshot ever contained production-derived accounts.
2. Force password resets for every affected non-synthetic account.
3. Rewrite shared Git history with `git filter-repo` or an equivalent service
   procedure, then invalidate old clones and cached artifacts.
4. Review access logs for unexpected authentication attempts.
5. Store future local snapshots outside the repository and generate test data
   from synthetic fixtures only.

History rewriting and account rotation are intentionally not automated by the
application repository because both require repository-owner coordination.

