# Design decisions

**The list lives in the workflow.** A Google Sheet would be nicer to edit on a phone, but it adds a second credential and a second thing to break. Four to ten lines that change once a year fit in a settings field, and the Done links mean the list rarely needs touching.

**Done links instead of editing dates.** The moment someone renews is the moment they have the confirmation in front of them. One tap from the reminder is the least effort it can take. The link rolls the date forward from the old due date, not from the day it was tapped, so renewing a week early does not shift next year's reminder.

**An Undo on the Done page.** A thumb slips. The page that confirms a Done has a link that puts the item back exactly as it was, working once.

**No inbound text commands.** Replying DONE by text would need the business number's incoming webhook, which in most setups already belongs to something else. A link needs nothing but the workflow's own webhook.

**One-time codes, not a shared secret.** Each link carries a random code tied to one item and one due date. It works until it is used or the date changes. There is no password to set up and nothing to leak that opens the other items.

**The list wins.** If someone changes a date in the list after a link rolled it, that date is used, earlier or later, and the roll is dropped. A person correcting the record should never have to fight the automation.

**One text a day.** Everything due is in one message. A second trigger on the same day sends nothing, so a republish or a retry never doubles the text.

**Overdue every day by default.** An expired license is not a thing to be reminded about weekly. It can be changed to weekly or off.

**Bad lines are reported, once.** A date it cannot read is named in a text, with the formats it accepts, and not repeated every morning. It is said again only if the lines it cannot read change.

**Numbers read from settings keep 0.** Zero switches overdue reminders off, so a blank setting falls back to the default but a 0 is kept.
