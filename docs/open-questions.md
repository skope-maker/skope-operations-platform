# Open questions for the next phase

Plain-language questions for the team, one list for all eight requests. Fill in the **Answer** column as replies
arrive, and keep this file in git so everyone works from the same answers.

Last updated: 2026-10-20

## Status at a glance

| # | Request | Status | Waits for |
| --- | --- | --- | --- |
| 1 | Item search everywhere, the same search box on every screen | **Done** (2026-10-20) | Nothing |
| 2 | Rista connection for live orders and sales | Not started | DotPe API details |
| 3 | Brand-only logins for clients (Swiggy and Zomato orders) | Can start the login part now | Answers below; orders need DotPe |
| 4 | Sales reports with date range and download, no other brand's data | Date range and download exist; brand privacy not yet | Answers below |
| 5 | Menu management synced to Rista | Not started | Answers below and DotPe API |
| 6 | Item photos under 200 KB | Not started | Answers below |
| 7 | Production vs sales tracking | Not started | Walkthrough with the teams |
| 8 | Roles and permissions | Six roles exist today | Confirmed list from the users |

## What the website already has

- **Sales report:** date range, brand filter and download (CSV). But today every logged-in person can see every brand. Nothing limits a person to their own brand yet.
- **Logins:** six roles (Admin, Procurement manager, Store keeper, Store manager, Chef, Management). Logins are not tied to a brand, and there is no client login.
- **Not built yet:** Swiggy or Zomato orders, the DotPe Rista connection, item photos.

## 1. Item search (done)

**What was asked:** wherever someone picks an item, it should be the same search box, built once and reused.

**What was built:** one shared search box is now used on every screen where an item is picked: purchase receipt, kitchen
request, stock transfer, stock adjustment, wastage, R&D trial, recipe ingredients, sub-recipe output and ingredients, and the
item filters in the inventory ledger and the Item Ledger report. It searches by name, code and category. It follows each screen's
flow:

| Screen | Stock shown in the results |
| --- | --- |
| Kitchen request | At the store that supplies that kitchen |
| Stock transfer | At the location stock is moving **from** |
| Stock adjustment | At the location being adjusted |
| Wastage | At the kitchen chosen on the form |
| R&D trial | At the R&D kitchen (trials use its stock) |
| Purchase receipt, recipes | No stock (not relevant there) |

The two history filters also find deactivated items, so old records stay searchable. Data-entry screens do not offer deactivated
items. Prepared (sub-recipe) items carry a "Prepared" label.

| # | Question | Answer |
| --- | --- | --- |
| 1 | Sub-recipes (in Production) and dishes (in Sales) are still picked from a list, not searched. Should they get the same search box? | |

## 2. Rista connection

| # | Question | Answer |
| --- | --- | --- |
| 2 | Is there one Rista account for all brands, or does each brand or client have its own? | |
| 3 | Can DotPe give us a test account first, so we don't touch real orders while building? | |
| 4 | Does DotPe charge for this connection? If yes, who pays? | |
| 5 | Who at DotPe can we contact for technical questions? | |
| 6 | How fresh must orders be on our website: within 1 minute, within 5 minutes, or a few times a day? | |

## 3. Client logins (one brand each)

| # | Question | Answer |
| --- | --- | --- |
| 7 | Who will log in: only the brand owner, or their staff too? Roughly how many people per brand? | |
| 8 | Can one client own more than one brand? | |
| 9 | Does a brand sell from more than one outlet? Should the client see all of their outlets? | |
| 10 | Besides orders and sales reports, should clients see anything else, such as stock or costs? | |
| 11 | Should clients see customer names and phone numbers on orders, or should we hide them? | |
| 12 | Only today's orders, or past orders too? How far back? | |
| 13 | Who creates client logins? How should a client reset a forgotten password? (Today only the admin can set passwords.) | |

## 4. Sales reports

| # | Question | Answer |
| --- | --- | --- |
| 14 | Can you share a sales report you use today, so we copy the same columns? | |
| 15 | Download as Excel, CSV or PDF? (It is CSV today.) | |
| 16 | Should the report split sales by Swiggy, Zomato and dine-in? | |
| 17 | Should it show commissions, discounts and taxes, or only the sale amount? | |
| 18 | Our own team (admin, management) sees all brands, and clients see only theirs. Is that right? | |

## 5. Menu management

| # | Question | Answer |
| --- | --- | --- |
| 19 | In our website, "items" means raw materials (onion, oil) and menu dishes are "recipes". Do brand owners edit the menu dishes customers order? | |
| 20 | Should a change go live on Swiggy and Zomato immediately, or should our admin approve it first? | |
| 21 | Can owners delete a dish, hide it, or mark it out of stock? | |
| 22 | Can the same dish have different prices on Swiggy, Zomato or different outlets? | |
| 23 | Besides name, description, price and photo, do owners need category, veg or non-veg, sizes, add-ons or tax? | |
| 24 | If someone changes a dish directly in Rista and it differs from our website, which one is correct? | |

## 6. Photo size

| # | Question | Answer |
| --- | --- | --- |
| 25 | If a photo is over 200 KB, should the website shrink it automatically, or refuse it and ask for a smaller one? (Suggested: shrink automatically.) | |
| 26 | Do Swiggy or Zomato have photo rules we must follow, such as square shape or minimum size? | |

## 7. Production vs sales tracking

| # | Question | Answer |
| --- | --- | --- |
| 27 | What do the teams track today? Can you share the sheet, with real examples where quantity sent did not match sales? | |
| 28 | Do outlets count what is left at the end of the day? Who enters it, and when? | |
| 29 | Should the website warn automatically when the gap is above a limit, such as 5%? Who should be told? | |
| 30 | The website already has a daily closing that compares expected stock with the counted stock. Is that close to what you need? | |

## 8. Roles and permissions

| # | Question | Answer |
| --- | --- | --- |
| 31 | Please list each role you want, who will have it, and what they may do. (Today: Admin, Procurement manager, Store keeper, Store manager, Chef, Management.) | |
| 32 | Who may edit menu dishes? Who may download reports? Who may approve purchases? | |

## General

| # | Question | Answer |
| --- | --- | --- |
| 33 | Which of these matter most? What should come first? | |
| 34 | Is there a target date? | |
| 35 | Once real clients log in and real orders flow in, the free test setup is not enough (it sleeps when idle, can lose uploaded photos, small database). Paid hosting will be needed. Who approves that cost? | |
