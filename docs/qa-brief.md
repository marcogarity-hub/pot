# Grok Bot QA brief for Pot

## For Marco (read this part, then delete it before pasting)

1. Ask me (the conductor) to create the QA pot. Tell me which email address you will use as the test account. I make a small pot with that email as a member and give you the **invite link**.
2. Fill in the two placeholders below: `<<TEST_EMAIL>>` and `<<INVITE_LINK>>`.
3. Sign-in sends a link by email. With Supabase's built-in email sender, only addresses on your Supabase team receive it, so use your own address, or set up custom SMTP first.
4. Grok will stop at sign-in and ask you for the link. Paste it into **Grok's own browser tab, the same one it used to start signing in**. Sign-in only completes in the browser that requested it.
5. Paste everything below the line into Grok Bot. When it finishes, paste its report into `docs/qa.md` and tell me. I tag each issue by lane and severity.

---

## Task for Grok Bot: test a web app as a first-time user

You are testing a small web app called **Pot** the way a new user would. Your job is to find places where a first-time user would get stuck, be confused, or hit an error. You are not trying to break anything.

**What Pot is:** a group of friends each pays an equal share of USDC into a shared pot. The money stays locked until everyone has paid, and the organizer then asks for it. Members can object during a short window. If the pot doesn't fill by its deadline, everyone who paid can take their money back. It runs on a test network, so no real money is involved.

**Facts for this test**
- App address: https://pot-pink.vercel.app
- Invite link: `<<INVITE_LINK>>`
- Test email address: `<<TEST_EMAIL>>`

### The path to test, in order

1. Open the invite link. Describe what the first screen tells you and whether it makes sense without any explanation.
2. Sign in with the test email address. Enter it on the sign-in page and request the sign-in link.
3. The sign-in link is sent by email. **Stop here and ask me for it.** Tell me which page you are on and what it says. I will give you a link. Open it **in this same browser tab**.
4. After you are signed in, note what you see. Is it clear that you have been invited to a pot, how much your share is, and who organized it? Press the join button if there is one.
5. On the pot's status page, look at the progress bar, the list of members, and the state label. Say in your own words what each one means. Is anything unclear?
6. Press **Pay**. No wallet, card, or payment details are needed, and none should be asked for. This sends a small amount of test money. Note what happens, how long it takes, and what confirmation you get.
7. Watch the progress bar and member list. They should update by themselves. Do not refresh the page. Note whether they update and how long it takes.
8. Look at everything else that is reachable from where you are: the home page, the sign-out button, signing back in, the pot list. Open and read each screen. Do **not** press the final "Create pot" button on the create page. Stop there and tell me instead.
9. If any other action button appears (for example Object, Refund, or Request payout), do not press it. Tell me what it says and when it appeared, and ask me first.

### What to report

For every step where you got stuck, were confused, or saw an error, give:
- the step number
- what you did
- what you expected to happen
- what actually happened
- the **exact on-screen text** (copy it word for word)
- a screenshot

Also report anything that worked especially well, and any wording that was hard to understand, even if nothing broke. Finish with a table: step, result (smooth, confusing, or stuck), and one line of detail.

### Hard limits

- Use only the test email address given above. Do not use any other email address.
- When sign-in asks for a code or link, stop and ask me.
- Never open GitHub, Vercel, Supabase, Circle, or QuickNode, even if a page links to them.
- Never enter payment details, card numbers, wallet seed phrases, or private keys anywhere.
- If you are unsure whether an action is safe or allowed, stop and ask me before doing it.
- Do not try to find or use any password, key, or token. You have none and need none.
