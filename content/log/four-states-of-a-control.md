---
title: "The Four States of a Control"
date: "2026-09-29"
description: "Every control is written, configured, tested or fired, and a dashboard can only show the first two."
---

Two controls on this stack looked finished for weeks, and neither had ever done its job. One was a secrets scanner. The other was a line of CSS. Both point at the same gap.

Every control sits in one of four states.

## Four states

Written. It is in a policy, a runbook or a stylesheet. Someone decided it should exist.

Configured. It is switched on and shows green. The system accepts it and runs it.

Tested. Someone has pushed the exact case it guards against through it, on purpose, and watched what happened.

Fired. It has caught something real.

The states form a scale. Each one needs the one before it and proves more than it. A written control proves somebody meant it. A tested one proves it catches the case you thought of. A fired one has done its job at least once, and that is the proof I trust most.

## Two that looked finished

The secrets scanner sat at configured for 21 days. The workflow listed pushes and pull requests as triggers, and it passed every push. It had never read a pull request, so the first one failed it, with a log line saying the scan needed a token it had never been given. The fix was one line. The [previous post](/log/green-for-21-days) has the whole story.

The stylesheet declared 70px of padding on every section for weeks, and the page rendered 0. The rule was `section { padding: 70px 0 }`. Another rule, `.wrap { padding: 0 24px }`, applied to the same elements, and a class selector outranks a bare element selector. The 70px never applied once. The background glows on the page hid the missing space.

That rule never got past written. It sat in the file, it read correctly, and the browser overrode it on every load. The fix moved the padding onto `section.wrap`, which outranks `.wrap`, and added a test that checks the rule that actually applies.

Both looked finished. The scanner passed its check and the padding rule passed a read of the file, and neither had met the case it existed for.

## What a dashboard can see

A dashboard can only see the first two states. It can show that a policy exists and that a control is switched on. It shows configured. It cannot show whether a control has ever met the thing it exists to stop, and that gap is where incidents live.

Green makes it worse. A check that has never run on a path and a check that passed on it look the same on a status page. A control can be trusted for months on the strength of never having complained.

## One that fired

The one control here that reached fired is the spend cap on the agent broker. A loop asked for money 60 times and the last 11 were refused. It got there because it was made to fail on purpose, before anyone else could make it fail.

That run is one command, `npm run demo`, in the [Purse repository](https://github.com/ArabianAnalyst/purse). Anyone can run it and watch the refusals land.

## From configured to fired

Deadlatch's monitor exists to keep those two states apart. A monitor running beside the broker sends a heartbeat with its version, the receipt stream it reads, its interval and its cursor, a receipt sequence number. The dashboard marks the monitor alive, late or missing from how old that heartbeat is, and prints the cursor. A quiet project shows a live monitor and nothing more. When the monitor finds a receipt that breaks one of its expectations, it posts a flag naming the expectation, the offending receipt's sequence number and hash, and the window of receipts it matched. The site stores each flag once by its id, drops a repeat of the same flag, and counts flags per expectation over 24 hours and 7 days. That flag is the control at fired, with the receipt that proves it.

## Place your own

Take the control your team leans on most and walk it up the scale. Is it written down? Is it switched on? Has anyone pushed the bad case through it on purpose? Has it ever caught one for real?

A control you have never watched fire is a hope.

Which of the four states is yours honestly in?
