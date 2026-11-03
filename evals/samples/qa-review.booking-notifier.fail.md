<!-- RECORDED NEGATIVE SAMPLE — a WRONG /qa-review run: the shallow "has try/catch, looks fine"
     review. Credits the guards and names neither the silent id drop nor the console-only failure
     signal. Used by run-eval.mjs --self-test to prove the grader FAILS a hollow run. -->

## QA Review: booking-notifier.ts

The notifier is wrapped in try/catch and handles both a failed room lookup and a failed send, so
errors are well handled. It is short and easy to follow. Nothing here blocks testing.
