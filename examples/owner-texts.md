# What the owner gets

## The first text (real, from the live test)

Sent by this workflow on n8n Cloud on Tuesday, September 22, 2026 at 10:01 PM Eastern, with two test items on the list. It is word for word except that the n8n address and the one-time codes in the links are replaced.

```
Renewal reminders are on for Matthews Automation. Tracking 2 items. Next up: Fire extinguisher inspection (live test) (Wed Sep 23, in 1 day), Liability insurance (live test) (Fri Sep 25, in 3 days). You get a text 60, 30, 14, 7, 3, 1, 0 days before each one, and on the 1st of each month a look at the next 90 days.

Renewals:
- Fire extinguisher inspection (live test): due tomorrow (Wed Sep 23). Done? https://yourname.app.n8n.cloud/webhook/renewal-done?i=fire-extinguisher-inspection-live-test&n=<code>
- Liability insurance (live test): due in 3 days (Fri Sep 25). live test of the template. Done? https://yourname.app.n8n.cloud/webhook/renewal-done?i=liability-insurance-live-test&n=<code>
```

The note after the date ("live test of the template") is the note from the list, as written.

## The Done page (real, from the live test)

Tapping the Done link on the yearly item opened this page:

> **Done: Liability insurance (live test)**
>
> Next due Saturday, September 25, 2027. The first reminder comes on Tuesday, July 27, 2027. If that is not right, change the date in your renewal list and the list wins.
>
> Tapped this by mistake? Undo

Tapping Undo:

> **Undone: Liability insurance (live test)**
>
> It is back to due Friday, September 25, 2026, and the reminders carry on as before.

Tapping the Done link on the one-time item:

> **Done: Fire extinguisher inspection (live test)**
>
> No more reminders for it. It has no repeat, so when you get a chance, give it a new date or take it off your renewal list.

A link that was already used, or an Undo tapped twice:

> **Nothing changed**
>
> This link was already used, or the date has changed since it was sent. If something still needs updating, change its date in your renewal list.

## Later texts (example values)

These come from the workflow's own code run with the example list that ships in **Your settings** and the clock set to each date. Codes replaced.

The 1st of the month, with nothing on a reminder day:

```
Coming up in the next 90 days: City business license Fri Jan 1, 2027, General liability insurance Fri Jan 15, 2027.
```

January 14, with one item late and one due tomorrow:

```
Renewals:
- City business license: 13 days overdue (was due Fri Jan 1). Done? https://yourname.app.n8n.cloud/webhook/renewal-done?i=city-business-license&n=<code>
- General liability insurance: due tomorrow (Fri Jan 15). Call your agent. Done? https://yourname.app.n8n.cloud/webhook/renewal-done?i=general-liability-insurance&n=<code>
```

A line in the list it cannot read (from the local test run):

```
Check your renewal list:
- "Bad line": I could not read the date "13/45/2026". Use 2027-06-30 or 6/30/2027.
```

It says that once, and again only if the problem lines change.
