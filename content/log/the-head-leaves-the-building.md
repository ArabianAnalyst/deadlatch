---
title: "The Head Leaves the Building"
date: "2026-09-08"
description: "The chain head now lands in a public transparency log every five minutes. A stranger verifies it with two public keys. A rebuilt chain fails in one line."
---

A week ago this site said a hash chain in your own hands is tamper-evident to you and meaningless to everyone else. Whoever holds the log can rewrite an entry, recompute every hash after it, and hand you a chain that verifies perfectly.

The fix named then was an anchor. Commit the head somewhere the writer cannot reach and someone else can read. That fix is now running against a real broker, and this post is the receipt.

## What runs now

A witness process sits beside the payment broker. It is not the broker. It has its own key and its own port, and the broker never sees either.

Every five minutes it reads the head of the receipt chain. If the head moved, it signs a short artifact, the stream name, the position in the chain, and the head hash, and submits the signature to Sigstore's Rekor transparency log. The log is public, append-only, and run by people who have never heard of this project.

The log answers with three things. The entry it wrote. An inclusion proof, the Merkle path from that entry up to the tree root. And a checkpoint, the root signed by the log's own key and co-signed by three independent witnesses who watch the log for consistency.

The witness stores all of it beside the chain and serves it read-only. From then on the operator's database holds a claim the operator can no longer change. The head at position 5 was this hash, and a log the operator does not run says so.

## What the verifier recomputes

None of this is worth anything if verification means trusting the witness. So the verifier trusts nothing it is handed.

It recomputes the leaf hash from the anchored artifact. It walks the inclusion path and checks it lands on the root. It checks the checkpoint signature under the log's public key, and checks the checkpoint root equals the proof root at the same tree size. It checks the witness signature under the witness's public key. Then it recomputes the chain from the first receipt and checks the head at position 5 is the head the log holds.

Two public keys. The log's, published by Sigstore in a trust root anyone can fetch. The witness's, published on the witness's own index. Nothing from the operator. No database access, no API token, no phone call.

## The sceptic's run

This is the part that matters. The chain and the anchors were exported from the live deployment into an empty directory, and the verifier was run from npm with only those two keys.

| Input | Exit | Verdict |
|---|---|---|
| The chain as exported | 0 | ok, covered up to position 5 |
| Receipt 2 rewritten, every later hash rebuilt | 1 | chain consistent, anchor fails |
| Receipt 4 edited, nothing rebuilt | 1 | chain broken at 4, anchor holds |

Read the middle row twice. The rebuilt chain is internally perfect. Every hash matches the one before it. Last week's post said this is the case a hash chain cannot catch, and it still cannot. The verifier's own chain check reports ok.

The anchor catches it in one line.

```json
{
  "ok": false,
  "coveredUpTo": null,
  "chain": { "ok": true },
  "anchors": [
    { "seq": 5, "ok": false, "reason": "head mismatch at seq 5" }
  ]
}
```

The head at position 5 in the public log is not the head this chain arrives at. To make that line go away, whoever rebuilt the chain would need to rewrite an entry in Sigstore's log, forge the log's signature over a new root, and forge three independent co-signatures on top. Out in the open, where other people already hold copies.

The bottom row is the ordinary case. One entry edited in place, no rebuild. The chain breaks at 4 like it always did, and the anchor still holds because the head was never touched. Two different failures, two different detectors, and the verifier names which one fired.

## What it still does not prove

Two honest gaps.

Time. This log does not stamp entries with a clock, so the anchor proves order and existence, not when. The head at position 5 existed before log entry 101844748 was written, and that entry existed before every entry after it. A customer who needs a wall-clock timestamp needs a signed timestamp authority on top, and that is a later step, not this one.

Omission. An anchor proves what is there was not rewritten. It says nothing about the entry that was never written. That gap closes the way last week's post said it does, with the boundary as the writer. The broker writes the receipt before it lets the payment through, so an action without a receipt is an action that did not happen. The anchor and the gate are two halves of one wall. This post is the anchor half, running.

## Run it yourself

The reference broker's chain, its anchors, and both public keys are published here. Nothing else is needed.

```bash
curl -sO https://www.deadlatch.dev/witness/chain.json
curl -sO https://www.deadlatch.dev/witness/anchors.json

npx -p @olurabian/receipt receipt-verify chain.json \
  --anchors anchors.json \
  --log-key log2025-1.rekor.sigstore.dev=MCowBQYDK2VwAyEAt8rlp1knGwjfbcXAYPYAkn0XiLz1x8O4t0YkEhie244= \
  --witness-key MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEq/VhzmgczlJPDPdH2jpPHB/CfBN9aHgO75EO/KP60Rjl7QRI3q8W7gY2bekUV+R2hutZI6GFLAjpvN1rUjMuQQ== \
  --stream purse
```

The log key is Sigstore's, taken from [their published trust root](https://raw.githubusercontent.com/sigstore/root-signing/main/targets/trusted_root.json). The witness key is [the one the witness serves](/witness/keys.txt). Exit 0 only when the chain verifies and at least one anchor holds. Exit 1 with the reason otherwise.

Then open chain.json, change one amount, rebuild the hashes, and run it again.

Last week ended with two questions. Where does the record live. Could the agent have acted without writing it.

The first one now has a different answer. Half of it lives somewhere the operator cannot reach.
