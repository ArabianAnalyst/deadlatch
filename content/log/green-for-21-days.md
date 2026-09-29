---
title: "Green for 21 Days"
date: "2026-09-29"
description: "The secrets scan on this repo passed every push for 21 days, then failed the first pull request it ever saw."
---

The secrets scanner on this repo passed for 21 days straight. It had never scanned a pull request.

The security workflow went in on 1 September. It runs gitleaks over the git history to catch committed secrets. From its first commit it listed two triggers, push and pull_request. Every push since that day came back green. On Tuesday 22 September the repo got its first pull request, and the same check failed.

Nothing had leaked. The scan never got as far as the code.

## The red line

The gitleaks step on pull request #1 stopped before it scanned a single commit. The log said why.

```text
GITHUB_TOKEN is now required to scan pull requests
```

The action is gitleaks-action v2. It refuses to scan a pull_request event unless `GITHUB_TOKEN` is set in the step's environment. On a push event it never asks. So a workflow without the token passes every push, and the missing line stays invisible until the first pull request arrives.

Six other repos in this stack pass the token to that step. This one I copied wrong on day one. Nothing could have told me, because nothing had ever taken that path.

## What the tick meant

For three weeks a green tick on this repo meant one thing. The scan ran on pushes and found nothing. It said nothing about pull requests, because no pull request had ever run.

Until 22 September every commit reached main by a push, so the push scan did cover the route in use. The day the route changed, the check failed on the new one. It had only ever been proven on the path it had already seen.

The workflow was even edited once in between. On 7 September the push trigger was widened from main and master to every branch, so a commit could prove itself before it reached main. That edit was in the same file as the gitleaks step and left the step alone. Every run after it was green too, so nothing pointed at the step.

On paper the pull request path was guarded from 1 September. In practice it was configured and never exercised. A check that has never run and a check that passed look the same, because neither leaves a red mark.

Most pipelines carry a few of these. A rollback nobody has rehearsed. A restore nobody has tested. An alert that has never once fired. All of them look finished.

## The fix

The fix was one line, the token, plus the `env` key that holds it.

```yaml
      - name: gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

That token is the one GitHub Actions issues to each workflow run. The workflow sets `contents: read` at the top, so the scan can read the repository and cannot write to it.

Finding it took a pull request opened for something else entirely.

The failing run and the fix are both public on [pull request #1](https://github.com/ArabianAnalyst/deadlatch/pull/1).

## Make it fail on purpose

A check you have only seen pass tells you it runs. It does not tell you it catches anything. To know that, hand it the case it guards against, on the route real changes take.

For a secrets scan, open a pull request from a throwaway branch with a string shaped like a key in it. If the check goes red for the right reason, it has been tested. If it goes red for the wrong reason, as this one would have, you find out on your own schedule.

The rollback, the restore and the alert get the same treatment. Run each one once, on a quiet day, while nothing is on fire.

A control that has never fired is a guess.

Which check in your pipeline has never met the thing it guards against?
