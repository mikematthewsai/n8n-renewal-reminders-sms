# Verified results

Everything below was run on the Code nodes in [`workflow/`](../workflow/renewal-reminders-sms.json). What was not run is listed at the end.

## Live, on n8n Cloud 2.39.7, 2026-09-22

A real Twilio number texting the owner's own cell, and the Done links tapped against the published workflow's real webhook. The list had two test items: a yearly one due in 3 days and a one-time one due the next day. The schedule was set to a single run a few minutes ahead. Execution ids are n8n's own.

| Run | Execution | What happened | Result |
| --- | --- | --- | --- |
| A | 398 | First scheduled run | Passed. One text from the business number to the owner: the startup message, then both items with a Done link each. Twilio accepted it (message SID returned, status queued) and the run went down the "delivered" branch. The text is in [examples/owner-texts.md](../examples/owner-texts.md) |
| B | 399 | Done link on the yearly item | Passed. HTML page: next due Saturday, September 25, 2027, first reminder Tuesday, July 27, 2027 (60 days before) |
| C | 400 | Same Done link again | Passed. "Nothing changed" |
| D | 401 | Undo link from that page | Passed. Back to due Friday, September 25, 2026 |
| E | 402 | Undo link again | Passed. "Nothing changed" |
| F | 403 | Original Done link after the Undo | Passed. Rolled to 2027 again, so an undone link works once more |
| G | 404 | Done link on the one-time item | Passed. "No more reminders for it", with an Undo link |
| H | 405 | Second scheduled run the same day, after publishing again | Passed. Nothing sent: "already ran today". The stored memory survived the republish |

The stored memory after the taps matched: the yearly item at 2027-09-25 with the list date 2026-09-25 kept beside it, the one-time item marked done for 2026-09-23, both links used up, and nothing waiting to be resent.

After testing, the workflow was switched off and the settings and schedule went back to the example values and 8 AM.

## Local n8n 2.40.5 against a mock Twilio API

The same workflow file, with the Twilio base URL pointed at a local mock so a refusal could be forced, and the schedule set to every minute so each "morning" came quickly. To make the next run count as a new day, the stored last-run date was moved back one day in the database. Every run was a production execution of a published workflow. 32 checks over 16 executions, all passed.

| Setup | Result |
| --- | --- |
| First run with 4 items and one line with a bad date | One text: startup message, 3 reminders (tomorrow, 3 days, 30 days), the far item left out, the bad line named with the formats it accepts |
| Second run the same day | Nothing sent |
| Done on a yearly item | Rolled to next year, first reminder 60 days before, page served as HTML |
| Same link again, Undo, Undo again, original link again | Nothing changed, put back, nothing changed, rolled again |
| Done on a one-time item | Stopped |
| Wrong code, unknown item, junk in the link | Nothing changed, no error |
| Next morning | Only the item still on a reminder day. No startup message, bad line not repeated |
| Twilio refuses the text | "Went out?" takes the false branch and the text is kept |
| Next morning, Twilio fine | The kept text goes out with the new one, then the memory is cleared |
| Date changed in the list after a Done tap, published again | The list date is used and the rolled date dropped |
| Example numbers left in | The run stops with "replace the example phone numbers" |

## Automated checks

[`tests/renewals.test.js`](../tests/renewals.test.js): 61 checks against the Code node source in the workflow file, with the clock frozen. CI runs them on every push.

## Code parity

SHA-256 values, computed in the n8n page for the n8n copies and locally for the file:

- Code nodes of the tested copy, of a clean copy imported from this file, and of this file: `02dd07649010bdea753ed8f00492a2ba6e53e5c2f1908f690ff1d5836fde7f78`
- Nodes and connections without credentials, for the same three (the tested copy after it was reset to the example settings): `dfa90015066fafe3453a4eb3b49b26fa8c71f384a4459249fed4ff0ebf2b3696`
- The file itself: `b6b7b80bc17cf08e89d50f3d156ca96f8e7b8dbdb3e899bb9458992de4608c8a`

The only change after the live runs was a capital letter at the start of two notes in the example list. The Code nodes are the ones that ran.

## Not covered

- Delivery to the handset. Twilio accepted the live text; its delivery status was not read back.
- A real Twilio refusal, a real next morning and the 1st-of-the-month look ahead. Simulated locally and in the automated checks.
- A text longer than one SMS segment arriving in one piece on every carrier. The startup text in the live run was about 700 characters.
