# Next phase: requirements and questions

Last updated: 2026-10-20

This document lists what the team asked for, what we understood, and the questions we need answered **before** we
start building. Clear answers now save rework later.

## How to answer

Reply with the **question number and your answer**, for example:

> Q4: B
> Q11: Yes
> Q20: see attached file

Every question says how to answer it:

| Answer type | What to send |
| --- | --- |
| **Yes / No** | Just yes or no. Add a line only if there is an exception. |
| **Pick one** | The letter of the option (A, B, C). If none fits, write your own answer. |
| **Number** | A number, for example 5 or 15 minutes. |
| **List** | Names, one per line. |
| **Fill the table** | Edit the table in this document, or reply with the changes. |
| **Send a file** | Attach an example: an Excel sheet, a screenshot, a PDF. Real examples help most. |
| **Short answer** | One or two sentences. |

**When needed:** "Before start" means we cannot build that part without the answer. "Later" means we can start without it.

---

## 1. What the team asked for

| # | Request | What we understood |
| --- | --- | --- |
| R1 | Item search | Search wherever users pick an item, including Kitchen request and Issue. **Done** (see section 9). |
| R2 | Live orders | Each client sees live Swiggy and Zomato orders for their own brand only, taken from DotPe Rista. |
| R3 | Sales reports | Bring Rista sales into the website. Pick a date range and a branch. Clients download reports. Each client sees only their own brand. |
| R4 | Catalog management | Brand owners add menu items and edit name, description, price and photo on our website, without opening Rista. Photos under 200 KB. |
| R5 | Catalog sync | Changes made on our website are sent to Rista and from there to Swiggy and Zomato. We must check what Rista allows, including different prices per channel. |
| R6 | Production vs sales | Record what is sent to each outlet and compare it with what was sold, so the team can find mismatches they track by hand today. |
| R7 | Roles | Admin plus about five or six other roles, including store staff. Each role sees only the screens and data it should. |

**Q1.** Is anything missing from this list, or understood wrongly? *Answer as: Short answer. When needed: Before start.*

---

## 2. Words we use (please correct if wrong)

Different people use these words differently. We need to agree on them first.

| Word | What we mean |
| --- | --- |
| **Client** | A company or person who owns one or more brands and logs in to see their own data. |
| **Brand** | A food brand sold to customers, for example on Swiggy and Zomato. |
| **Outlet / branch** | A place that sells a brand. In Rista this is a "branch". |
| **Kitchen / location** | A place in our website that holds stock: Main Store, Base Kitchen, Normal Kitchen, R&D Kitchen. |
| **Channel** | Where a customer orders: Swiggy, Zomato, dine-in, and so on. |
| **Menu item** | A dish a customer orders, with a price. In our website today these are called "recipes". |
| **Raw item** | An ingredient we buy and stock, for example onion or oil. In our website today these are called "items". |

**Q2.** Are these meanings right? Correct any that are wrong. *Answer as: Fill the table. When needed: Before start.*

**Q3.** When the team says "item" in R4 (catalog management), do they mean a **menu item** (a dish customers order), not a raw ingredient? *Answer as: Yes / No. When needed: Before start.*

**Q4.** Is an outlet (Rista branch) the same thing as one of our kitchens?
A) Yes, each outlet is one of our kitchens.
B) No, outlets are separate places that receive food from our kitchens.
C) Some are the same, some are not.
*Answer as: Pick one. When needed: Before start.*

**Q5.** Please fill this table with every client, brand and outlet. The first row is only an example.

| Client (company) | Brand | Outlet / branch name in Rista | Which of our kitchens cooks it | On Swiggy? | On Zomato? |
| --- | --- | --- | --- | --- | --- |
| *Example: ABC Foods* | *Example: Biryani Box* | *Example: Indiranagar* | *Example: Base Kitchen* | *Yes* | *No* |
| | | | | | |

*Answer as: Fill the table (or send your Excel). When needed: Before start.*

---

## 3. Roles and access (most important)

### 3a. What each role can do today

Please **correct this table**. Change any cell that is wrong, and fill the new rows and new columns (marked **?**).
Yes = allowed, No = not allowed.

| What the person does | Admin | Procurement manager | Store keeper | Store manager | Chef | Management | Brand owner (new) | Store staff (new?) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Record a purchase (goods received) | Yes | No | Yes | No | No | No | ? | ? |
| Approve or reject a purchase | Yes | Yes | No | No | No | No | ? | ? |
| Add or edit suppliers | Yes | No | Yes | No | No | No | ? | ? |
| Request stock for a kitchen | Yes | No | No | No | Yes | No | ? | ? |
| Issue or reject a stock request | Yes | Yes | Yes | Yes | No | Yes | ? | ? |
| Record production (sub-recipe batch) | Yes | No | No | No | Yes | No | ? | ? |
| Move stock between locations | Yes | No | No | Yes | No | No | ? | ? |
| Correct stock (adjustment) | Yes | No | No | Yes | No | No | ? | ? |
| Record and post daily sales | Yes | No | No | Yes | Yes | No | ? | ? |
| Record wastage | Yes | No | No | Yes | Yes | No | ? | ? |
| Run R&D trials | Yes | No | No | No | Yes | No | ? | ? |
| Create or edit recipes and sub-recipes | Yes | No | No | No | Yes | No | ? | ? |
| Upload from Excel (bulk upload) | Yes | No | No | Yes | Yes | No | ? | ? |
| Submit the daily stock count (closing) | Yes | No | No | No | Yes | No | ? | ? |
| Approve the daily closing | Yes | No | No | Yes | No | No | ? | ? |
| Reopen a closed day | Yes | No | No | No | No | No | ? | ? |
| Edit master lists (raw items, brands, units, kitchens) | Yes | No | No | No | No | No | ? | ? |
| Open the Reports screen | Yes | Yes | No | Yes | No | Yes | ? | ? |
| See the audit log (who did what) | Yes | No | No | No | No | No (see note) | ? | ? |
| Manage users, settings, delete records | Yes | No | No | No | No | No | ? | ? |
| **New:** see live Swiggy and Zomato orders | ? | ? | ? | ? | ? | ? | ? | ? |
| **New:** download sales reports | ? | ? | ? | ? | ? | ? | ? | ? |
| **New:** add or edit menu items, prices, photos | ? | ? | ? | ? | ? | ? | ? | ? |
| **New:** send menu changes to Rista | ? | ? | ? | ? | ? | ? | ? | ? |
| **New:** record production sent to an outlet | ? | ? | ? | ? | ? | ? | ? | ? |
| **New:** see the production vs sales comparison | ? | ? | ? | ? | ? | ? | ? | ? |

Note: the server already allows Management to read the audit log, but only Admin can open the screen that shows it.

**Q6.** Please correct and complete the table above. *Answer as: Fill the table. When needed: Before start.*

### 3b. The list of roles

**Q7.** Which roles do you want in the end? Write each role, and who will hold it (a name or a job title). Keep, rename or remove any of today's six roles (Admin, Procurement manager, Store keeper, Store manager, Chef, Management). *Answer as: List. When needed: Before start.*

**Q8.** "Store staff" was mentioned. Which is it?
A) The same as our Store keeper.
B) A new role for staff working at an outlet.
C) Something else (please describe).
*Answer as: Pick one. When needed: Before start.*

**Q9.** Can one person have more than one role (for example Chef and Store manager)? *Answer as: Yes / No. When needed: Later.*

### 3c. What data each person sees

Today, anyone who can open a screen sees **all** brands and **all** kitchens on it. These questions decide whether that should change.

**Q10.** Should our own staff (not clients) see only the kitchen they work at?
A) No, staff see all kitchens (as today).
B) Yes, each person sees only their own kitchen.
C) Only some roles are limited (please say which).
*Answer as: Pick one. When needed: Before start.*

**Q11.** Should our own staff see only some brands?
A) No, staff see all brands.
B) Yes, each person sees only the brands they handle.
*Answer as: Pick one. When needed: Before start.*

**Q12.** Besides live orders and sales reports, should a brand owner see anything else? Tick all that apply: A) stock, B) recipes and costs, C) wastage, D) production sent to their outlets, E) nothing else. *Answer as: List of letters. When needed: Before start.*

### 3d. Logins

**Q13.** Who creates logins for new staff and for clients?
A) Only the admin.
B) The admin, and each brand owner for their own staff.
*Answer as: Pick one. When needed: Before start.*

**Q14.** Roughly how many people will log in? Write a number for each: our staff, brand owners, client staff. *Answer as: Number. When needed: Later.*

**Q15.** How should someone reset a forgotten password? Today only the admin can set a new one.
A) Keep it that way.
B) A "Forgot password" link that sends an email.
C) A one-time code by SMS or WhatsApp.
*Answer as: Pick one. When needed: Later.*

---

## 4. Live orders (R2)

**Q16.** How quickly must a new order appear on our website? *Answer as: Number of minutes (for example 1, 5 or 15). When needed: Before start.*

**Q17.** What should be shown for each order? Tick all that apply: A) order number, B) time, C) channel (Swiggy or Zomato), D) dishes and quantities, E) amount, F) status (new, preparing, delivered, cancelled), G) customer name, H) customer phone, I) delivery address. *Answer as: List of letters. When needed: Before start.*

**Q18.** Should clients only **look** at orders, or also act on them (accept, reject, mark ready)? *Answer as: Short answer. When needed: Before start.*

**Q19.** Should the screen show only today's orders, or older orders too? If older, how far back? *Answer as: Short answer. When needed: Later.*

**Q20.** Should a new order make a sound or send a notification? *Answer as: Yes / No. When needed: Later.*

---

## 5. Sales reports (R3)

**Q21.** Please send a sales report you use today, so we can copy its columns. *Answer as: Send a file. When needed: Before start.*

**Q22.** Download format? A) Excel, B) CSV, C) PDF, D) more than one (say which). *Answer as: Pick one. When needed: Later.*

**Q23.** Should the report split sales by channel (Swiggy, Zomato, dine-in)? *Answer as: Yes / No. When needed: Before start.*

**Q24.** Should it include discounts, platform commission and taxes, or only the sale amount? *Answer as: Short answer. When needed: Before start.*

**Q25.** An order placed after midnight: which day does it count for?
A) The calendar day it was placed.
B) The previous business day, until a cut-off time (please give the time).
*Answer as: Pick one. When needed: Before start.*

**Q26.** Today, daily sales are typed into the website, and posting them uses up ingredients from stock through the recipes. When Rista sales come in automatically, should they do the same?
A) Yes, Rista sales replace typing and use up stock automatically.
B) No, Rista sales are only for reports; stock stays as it is today.
C) Not sure yet, discuss in the walkthrough.
*Answer as: Pick one. When needed: Before start.*

**Q27.** If A in Q26: each dish name in Rista must be matched to a recipe in our website. Who can prepare that matching list (Rista dish name to our recipe)? *Answer as: Short answer (a name). When needed: Before start.*

**Q28.** How should cancelled and refunded orders appear in reports? *Answer as: Short answer. When needed: Later.*

---

## 6. Catalog management (R4)

**Q29.** Can brand owners **add new** menu items, or only edit existing ones? *Answer as: Short answer. When needed: Before start.*

**Q30.** Besides name, description, price and photo, which fields do they need? Tick all that apply: A) category, B) veg or non-veg, C) sizes (half, full), D) add-ons, E) tax, F) available or out of stock, G) other (please list). *Answer as: List of letters. When needed: Before start.*

**Q31.** Should a change go live straight away, or be checked first?
A) Goes live straight away.
B) Our admin approves it first.
*Answer as: Pick one. When needed: Before start.*

**Q32.** If a photo is over 200 KB, what should happen?
A) The website shrinks it automatically (recommended, easiest for owners).
B) The website refuses it and asks for a smaller photo.
*Answer as: Pick one. When needed: Later.*

**Q33.** Do Swiggy or Zomato have photo rules, such as square shape or a minimum size? If you have their guidelines, please send them. *Answer as: Short answer or Send a file. When needed: Later.*

**Q34.** When a brand owner adds a new dish, must it also get a recipe in our website (so stock is used up when it sells)? *Answer as: Yes / No. When needed: Before start.*

---

## 7. Catalog sync with Rista (R5)

Several of these can only be answered by DotPe. Please forward them to your DotPe contact.

**Q35.** Should changes go only from our website to Rista, or also back (someone edits in Rista, our website updates)?
A) Only from our website to Rista.
B) Both ways.
*Answer as: Pick one. When needed: Before start.*

**Q36.** If a dish is changed in both places and they differ, which one is correct? A) Our website. B) Rista. *Answer as: Pick one. When needed: Before start.*

**Q37.** Can the same dish have a different price on Swiggy, Zomato and dine-in? Does it differ by outlet? *Answer as: Short answer. When needed: Before start.*

**Q38. (for DotPe)** Can Rista's API update item name, description, price, photo and availability? Can it set a different price per channel? *Answer as: Short answer from DotPe. When needed: Before start.*

**Q39.** If sending a change to Rista fails, who should be told? A) The person who made the change. B) The admin. C) Both. *Answer as: Pick one. When needed: Later.*

---

## 8. Production vs sales tracking (R6)

**Q40.** Please send the sheet the team uses today to track this, with real examples where the quantity sent did not match sales. *Answer as: Send a file. When needed: Before start.*

**Q41.** What is sent to outlets?
A) Finished dishes (counted in portions).
B) Prepared bases or sub-recipes (counted in kg or litres).
C) Both.
*Answer as: Pick one. When needed: Before start.*

**Q42.** Who records what was sent, and when? Who records what arrived at the outlet? *Answer as: Short answer. When needed: Before start.*

**Q43.** Do outlets count what is left at the end of the day? *Answer as: Yes / No. When needed: Before start.*

**Q44.** Above what difference should the website warn someone? *Answer as: Number (a percentage, for example 5). When needed: Later.*

**Q45.** Who should be warned, and how? A) A message on the website. B) Email. C) WhatsApp. *Answer as: Pick one or more. When needed: Later.*

**Q46.** Common reasons for a mismatch, to offer as choices when explaining one (for example wastage, staff meals, complimentary, wrong entry). Add or remove reasons. *Answer as: List. When needed: Later.*

**Q47.** Our website already has a daily closing that compares the expected stock with the counted stock at a kitchen. Is this similar to what you need, or quite different? *Answer as: Short answer. When needed: Before start.*

---

## 9. Item search (R1): done

Built on 2026-10-20. One shared search box is now used on all 11 screens where someone picks a raw item: goods received,
kitchen request, stock transfer, stock adjustment, wastage, R&D trial, recipe ingredients, sub-recipe output and ingredients,
and the item filters in the inventory ledger and the Item Ledger report. It searches by name, code and category, and shows stock
at the location that step uses.

The **Issue** step does not ask anyone to pick an item: the store issues exactly what the kitchen requested.

**Q48.** Is that right, or should the person issuing be able to add extra items that were not requested? *Answer as: Short answer. When needed: Later.*

**Q49.** Sub-recipes (on the Production screen) and dishes (on the Sales screen) are still chosen from a list. Should they get the same search box? *Answer as: Yes / No. When needed: Later.*

---

## 10. DotPe Rista access

**Q50.** Who at DotPe is our contact for technical questions? *Answer as: Short answer (name and email). When needed: Before start.*

**Q51.** Is there one Rista account for all brands, or a separate account per client? *Answer as: Short answer. When needed: Before start.*

**Q52.** Can DotPe give us a test account, so we do not touch real orders while building? *Answer as: Yes / No (from DotPe). When needed: Before start.*

**Q53.** Does DotPe charge for API access? If yes, how much and who pays? *Answer as: Short answer. When needed: Before start.*

**Q54.** When will the API documentation and keys be available? *Answer as: A date. When needed: Before start.*

---

## 11. Priorities, dates and hosting

**Q55.** Put the requests in order, most important first: R2 live orders, R3 sales reports, R4 catalog management, R5 catalog sync, R6 production vs sales, R7 roles. *Answer as: List. When needed: Before start.*

**Q56.** Is there a target date for the first part to be ready? *Answer as: A date. When needed: Before start.*

**Q57.** Who makes the final decision when answers differ between people? *Answer as: Short answer (a name). When needed: Before start.*

**Q58.** Once real clients log in and real orders flow in, the free test hosting is not enough: it sleeps when idle, can lose uploaded photos, and has a small database. Paid hosting will cost a small monthly amount. Who approves that cost? *Answer as: Short answer (a name). When needed: Later.*

**Q59.** Customer phone numbers and addresses are personal data. Should our website store them at all? *Answer as: Yes / No. When needed: Before start.*

---

## 12. Files we would like from you (checklist)

- [ ] The client, brand and outlet table (Q5)
- [ ] The corrected roles table (Q6)
- [ ] A sales report you use today (Q21)
- [ ] The production vs sales tracking sheet, with examples of mismatches (Q40)
- [ ] Swiggy or Zomato photo guidelines, if you have them (Q33)
- [ ] DotPe API documentation and test keys (Q54)

## 13. What can start before DotPe is ready

Once the "Before start" answers in sections 2, 3 and 8 are in:

- **Roles (R7):** new roles, and limiting people to their own kitchens and brands.
- **Client logins:** brand owner accounts that only ever see their own brand.
- **Sales report privacy:** reports and downloads limited to the person's own brand.
- **Catalog editing on our website (R4)**, including the 200 KB photo limit, without the Rista sync yet.
- **Production vs sales (R6):** recording what is sent and comparing it with sales typed into the website.

Waiting for DotPe: live orders (R2), importing Rista sales (R3) and sending menu changes to Rista (R5).
