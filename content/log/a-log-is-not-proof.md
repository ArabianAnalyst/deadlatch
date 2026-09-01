---
title: "A Log Is Not Proof"
date: "2026-09-01"
description: "A hash chain proves no single entry was edited. It does not prove the record was not rebuilt, or that nothing is missing. Where proof actually comes from."
---

A hash-chained audit log feels like proof. Each entry carries the hash of the entry before it, so the whole history is welded into one sequence. Alter entry 4 and the chain breaks at 5, 6, and 7. Nobody can quietly edit a single record in the middle and walk away clean. Run verification and the tampering shows.

That part is real. It is also where most people stop thinking, and it is exactly the wrong place to stop.

## What the chain actually proves

The chain proves internal consistency. It proves no single entry was altered in place. That is all it proves.

It does not prove the record was never rebuilt from scratch. Whoever holds the entire log can rewrite any entry they like, recompute every hash from that point forward, and hand you a chain that verifies perfectly. The math checks out because the math only checks the chain against itself.

So the honest question is not whether someone could edit one step. It is whether someone could have rebuilt the entire thing. For any log an agent or its operator controls end to end, the answer is yes. Every time.

That is the difference between tamper-evident and trustworthy. A chain in your own hands is tamper-evident to you and meaningless to everyone else.

## You cannot be your own witness

The fix for rewrite is an anchor. Commit the head of the chain somewhere the writer cannot reach and someone else can independently read. A public append-only log. A third-party timestamp. A witness that co-signs each action as it happens.

Now the game changes. Rewriting history no longer means recomputing hashes in private. It means forging every one of those external commitments too, out in the open, where other people are already watching and already hold copies.

A record you fully control is a record you can fully rewrite, however clean it looks. Anchored outside your reach, it stops being your word and starts being evidence. That distinction is the whole point.

## The entry that was never written

Here is the part almost nobody names. Omission.

You can anchor a perfectly clean chain and simply never write the entry for the action you did not want seen. The agent pays someone it should not have. The log stays quiet. Every anchored entry still verifies. Every hash still matches. The record is flawless and the record is a lie.

The anchor proves what is there was not altered. It says nothing about what is missing. Completeness is the harder half of the problem, and it is the half that matters most when the thing writing the log is also the thing being audited.

## The boundary is the writer

You close omission by making the record impossible to skip. The action cannot happen unless its entry is already committed and anchored first. No entry, no action. Not as policy, as mechanics.

That forces a structural change. The thing that writes the log has to be the same boundary that lets the action through. Not the agent, deciding after the fact what deserves a mention. The boundary writes ahead, then permits. If the write did not happen, the action does not happen either.

Write-ahead, and the boundary is the writer. That single move turns the log from a diary the agent keeps into a gate the agent passes through.

Follow this to the end and something clicks. Proving what happened and enforcing what is allowed are not two systems. They are one wall with two jobs. Anchor it so the past cannot be rewritten. Gate it so nothing acts without being written. Miss the first and your history is editable. Miss the second and your history is optional. Either way you are holding a story, not a record.

That is the shape everything on this site is built toward. Not a logger sitting next to a policy engine. One boundary that permits and proves in the same motion.

None of this sharpened in private. It got better being argued out in the open with other builders circling the same problem from different angles.

## Two questions

Before you trust an agent's account of what it did, ask two questions.

Where does the record live. Could the agent have acted without writing it.

If the only copy sits inside the thing being audited, and the agent could act without logging, you do not have proof. You have a story. It might even be a true story. You just have no way to know.
