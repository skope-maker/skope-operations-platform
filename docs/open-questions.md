# Skope Operations Platform: Next phase: requirements, decisions and questions

*Prepared by Youvraj · 20 October 2026 · Version 1*

> The Word version (`Skope-Next-Phase-Questions.docx`) is the one sent to the team. This file holds the same content so it can be read and diffed in git. Both are generated from one source.

## 1. About this document

The team asked for seven changes to the operations website. Before building them, we need a few answers so that we build the right thing the first time.

This document has three parts: what we understood from the request, the technical decisions we have already made (you only need to agree or disagree), and the questions only your team can answer.

### How to answer

Type your answers in the shaded "Your answer" column, then send the document back. You can also reply by email with the question number and the answer, for example "Q12: B" or "Q20: Yes".

| Answer type | What to write |
| --- | --- |
| Yes / No | Write yes or no. Add a line only if there is an exception. |
| Pick one | Write the letter of the option (A, B, C). If none fits, write your own answer. |
| Tick | Write all the letters that apply, for example "A, C, D". |
| Number | Write a number, for example 5. |
| Name | Write the person's name (and email if you have it). |
| Short answer | One or two sentences are enough. |
| Send a file | Attach an example to your reply: an Excel sheet, a screenshot or a PDF. Real examples help most. |
| Fill the table | Fill or correct the table this question points to. |

**When needed:** "Before start" means we cannot begin that part without the answer. "Later" means work can start without it.

## 2. What was requested

| No. | Request | What we understood | Status |
| --- | --- | --- | --- |
| R1 | Item search | Search wherever users pick an item, including Kitchen Intent and Issue, reusing one search box everywhere. | Done |
| R2 | Live orders | Each client sees live Swiggy and Zomato orders for their own brand only, taken from DotPe Rista. | Needs answers and DotPe access |
| R3 | Sales reports | Bring Rista sales data into the website. Choose a date range and a branch. Clients download reports. Each client sees and downloads only their own brand. | Needs answers and DotPe access |
| R4 | Catalog management | Brand owners add dishes and edit name, description, price and photo on our website without opening Rista. Photos stay under 200 KB. | Needs answers |
| R5 | Catalog sync | Changes made on our website are sent to Rista and from there to Swiggy and Zomato, including channel-specific prices if Rista allows it. | Needs answers and DotPe access |
| R6 | Production and sales tracking | Record what is sent to each outlet and compare it with sales, so the team can investigate the mismatches they track by hand today. | Needs answers |
| R7 | Role-based access | Admin plus about five or six other roles, including store staff, each limited to the right screens and data. | Needs answers |

## 3. Decisions we have made

Write Yes if you agree, or No with a short reason.

| No. | Topic | Our decision | Agree? |
| --- | --- | --- | --- |
| 1 | Working on the live DotPe account | There is no test account, so we start by only reading from Rista (orders, sales, menu). We change the menu only on dishes or an outlet you choose for testing, at times you agree. Every change we send is recorded together with the old value, so it can be undone. |  |
| 2 | How fresh live orders are | As live as DotPe allows: instantly if Rista can notify us, otherwise checked every minute. |  |
| 3 | Order history | The last 30 days are shown by default. Older orders can be found by choosing dates. |  |
| 4 | Cancelled and refunded orders | Listed separately and left out of sales totals. |  |
| 5 | Report downloads | Excel and CSV. |  |
| 6 | Photos over 200 KB | The website shrinks them automatically before saving, so owners do not need to resize anything. JPG, PNG and WebP accepted. |  |
| 7 | Which side is correct for menu details | Our website. If someone changes a dish directly in Rista, the website shows the difference so a person can decide. It never overwrites silently. |  |
| 8 | Failed changes to Rista | Retried automatically. If it still fails, both the person who made the change and the admin see it. |  |
| 9 | New-order alert | An on-screen alert with a sound, which each person can switch off. |  |
| 10 | Forgotten passwords | A "Forgot password" link that sends an email. The admin can still reset passwords. |  |
| 11 | One person with several roles | Allowed. |  |
| 12 | Customer details | We keep only what is needed to handle an order. We do not store customer phone numbers or addresses, to follow data protection rules and reduce risk. |  |
| 13 | Item search on more screens | The same search box will also be added where sub-recipes are picked (Production) and dishes are picked (Sales). |  |
| 14 | The Issue step | Stays as it is: the store issues exactly what the kitchen requested, so nobody picks items there. |  |
| 15 | Hosting before real clients use it | Move from the free test setup to paid hosting with daily backups and permanent photo storage. We will share the monthly cost for approval first. |  |
| 16 | Security before real clients use it | Remove the demo logins from the login page, require strong passwords, accept requests only from our own website, and stop putting login keys inside attachment links. |  |
| 17 | Running alongside the old sheets | Keep the current sheets for two weeks after each part goes live, to compare results. |  |
| 18 | Progress updates | A message whenever a part is ready to test, plus a short weekly call. |  |

## 4. Working with DotPe Rista without a test account

- Read first: during building we only read orders, sales and the menu from Rista. Reading cannot change anything.
- Write carefully: menu and price changes are tried only on dishes or an outlet you choose, at an agreed time, with someone from your team watching.
- Undo is always possible: every change we send is saved with the value it replaced.
- No surprises: nothing is sent to Rista automatically until you have tested it and agreed.

## 5. Words we use

| Word | What we mean | Correction |
| --- | --- | --- |
| Client | A company or person who owns one or more brands and logs in to see only their own data. |  |
| Brand | A food brand sold to customers, for example on Swiggy and Zomato. |  |
| Outlet or branch | A place that sells a brand. In Rista this is called a "branch". |  |
| Kitchen or location | A place in our website that holds stock: Main Store, Base Kitchen, Normal Kitchen, R&D Kitchen. |  |
| Channel | Where a customer orders: Swiggy, Zomato, dine-in, and so on. |  |
| Dish (menu item) | Something a customer orders, with a price. In our website today these are called "recipes". |  |
| Raw item | An ingredient we buy and stock, for example onion or oil. In our website today these are called "items". |  |

## 6. Questions for your team

### A. Project basics

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q1 | Which website should these changes be made in? (The company's MongoDB account also holds another app's data, with orders, item masters, ingredient indents and menu entries, which looks like a different website. If that is the one your team uses every day, the work may belong there.)<br>A) This project, the Skope Operations Platform (test copy: skope-operations-platform.onrender.com)<br>B) A different website the team already uses (please share its link and who has its code)<br>C) Not sure | Pick one | Before start |  |
| Q2 | Is anything missing or wrong in section 2, "What was requested"? | Short answer | Before start |  |
| Q3 | Put the requests in order, most important first: R2 live orders, R3 sales reports, R4 catalog management, R5 catalog sync, R6 production and sales tracking, R7 roles. | Short answer | Before start |  |
| Q4 | Is there a target date for the first part to be ready? | Short answer | Before start |  |
| Q5 | Who makes the final decision when people give different answers? | Name | Before start |  |
| Q6 | Who will test each finished part and confirm it is correct? | Name | Before start |  |
| Q7 | Is real data ready to load (raw items, recipes, brands, suppliers, outlets)? The website has Excel upload templates for this. | Yes / No (and Send a file) | Before start |  |
| Q8 | Who approves the monthly cost of paid hosting (decision 15)? | Name | Later |  |
| Q9 | Who manages the company's domain, so the live site can have an address like ops.skopekitchens.com? | Name | Later |  |

### B. Clients, brands and outlets

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q10 | Are the meanings in section 5, "Words we use", right? Correct any that are wrong. | Fill the table | Before start |  |
| Q11 | In catalog management (R4), does "item" mean a dish customers order, not a raw ingredient? | Yes / No | Before start |  |
| Q12 | Is an outlet (Rista branch) the same thing as one of our kitchens?<br>A) Yes, each outlet is one of our kitchens<br>B) No, outlets are separate places that receive food from our kitchens<br>C) Some are the same, some are not | Pick one | Before start |  |
| Q13 | Fill the client, brand and outlet table in section 7. | Fill the table | Before start |  |
| Q14 | Can one client own more than one brand? | Yes / No | Before start |  |

### C. Roles and access

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q15 | Correct and complete the roles table in section 8. Change any cell that is wrong and fill the cells marked "?". | Fill the table | Before start |  |
| Q16 | Which roles do you want in the end, and who will hold each one? Keep, rename or remove any of today's six roles (Admin, Procurement manager, Store keeper, Store manager, Chef, Management). | Short answer | Before start |  |
| Q17 | "Store staff" was mentioned. Which is it?<br>A) The same as our Store keeper<br>B) A new role for staff working at an outlet<br>C) Something else (please describe) | Pick one | Before start |  |
| Q18 | Today everyone sees all kitchens on the screens they can open. Should our staff see only the kitchen they work at?<br>A) No, staff see all kitchens (as today)<br>B) Yes, each person sees only their own kitchen<br>C) Only some roles are limited (please say which) | Pick one | Before start |  |
| Q19 | Should our staff see only the brands they handle?<br>A) No, staff see all brands<br>B) Yes, only the brands they handle | Pick one | Before start |  |
| Q20 | Besides live orders and sales reports, what else should a brand owner see?<br>A) Stock<br>B) Recipes and costs<br>C) Wastage<br>D) Production sent to their outlets<br>E) Nothing else | Tick | Before start |  |
| Q21 | Who creates logins for new people?<br>A) Only the admin<br>B) The admin, and each brand owner for their own staff | Pick one | Before start |  |
| Q22 | About how many people will log in? Give a number for each: our staff, brand owners, brand owners' staff. | Number | Later |  |

### D. Live orders (R2)

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q23 | Which details should be shown for each order? (Customer phone numbers and addresses are not stored, see decision 12.)<br>A) Order number<br>B) Time<br>C) Channel (Swiggy or Zomato)<br>D) Dishes and quantities<br>E) Amount<br>F) Status (new, preparing, delivered, cancelled)<br>G) Customer name | Tick | Before start |  |
| Q24 | Should clients only look at orders, or also act on them (accept, reject, mark as ready)? | Short answer | Before start |  |
| Q25 | Should our own team (admin, management) see live orders for all brands? | Yes / No | Before start |  |

### E. Sales reports (R3)

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q26 | Please send a sales report you use today, so we can copy its columns. | Send a file | Before start |  |
| Q27 | Should the report split sales by channel (Swiggy, Zomato, dine-in)? | Yes / No | Before start |  |
| Q28 | Should the report show discounts, platform commission and taxes, or only the sale amount? | Short answer | Before start |  |
| Q29 | An order placed after midnight: which day does it count for?<br>A) The calendar day it was placed<br>B) The previous business day, until a cut-off time (please give the time) | Pick one | Before start |  |
| Q30 | Today, daily sales are typed into the website and posting them uses up ingredients from stock through the recipes. When Rista sales come in automatically, should they do the same?<br>A) Yes: Rista sales replace typing and use up stock automatically<br>B) No: Rista sales are only for reports; stock stays as it is today<br>C) Not sure yet, discuss in the walkthrough | Pick one | Before start |  |
| Q31 | If you chose A in Q30, each Rista dish must be matched to a recipe in our website. Who can prepare that list? | Name | Before start |  |

### F. Catalog management (R4)

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q32 | What may brand owners do?<br>A) Add new dishes and edit existing ones<br>B) Only edit existing dishes | Pick one | Before start |  |
| Q33 | Besides name, description, price and photo, which fields do they need?<br>A) Category<br>B) Veg or non-veg<br>C) Sizes (half, full)<br>D) Add-ons<br>E) Tax<br>F) Available or out of stock<br>G) Other (please list) | Tick | Before start |  |
| Q34 | Should a change go live straight away, or be checked first?<br>A) Live straight away<br>B) Our admin approves it first | Pick one | Before start |  |
| Q35 | Can the same dish have a different price on Swiggy, Zomato and dine-in? Does it differ by outlet? | Short answer | Before start |  |
| Q36 | When a brand owner adds a new dish, must it also get a recipe in our website, so stock is used up when it sells? | Yes / No | Before start |  |
| Q37 | If you have Swiggy or Zomato photo guidelines (shape, minimum size), please send them. | Send a file | Later |  |

### G. Production and sales tracking (R6)

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q38 | Please send the sheet the team uses today, with real examples where the quantity sent did not match sales. | Send a file | Before start |  |
| Q39 | What is sent to outlets?<br>A) Finished dishes, counted in portions<br>B) Prepared bases or sub-recipes, counted in kg or litres<br>C) Both | Pick one | Before start |  |
| Q40 | Who records what was sent, and who records what arrived at the outlet? | Short answer | Before start |  |
| Q41 | Do outlets count what is left at the end of the day? | Yes / No | Before start |  |
| Q42 | Our website already has a daily closing that compares the expected stock with the counted stock at a kitchen. Is that similar to what you need? | Short answer | Before start |  |
| Q43 | Above what difference should the website warn someone? Give a percentage. | Number | Later |  |
| Q44 | Who should be warned, and how?<br>A) A message on the website<br>B) Email<br>C) WhatsApp | Tick | Later |  |
| Q45 | List the usual reasons for a mismatch, for example wastage, staff meals, complimentary, wrong entry. | Short answer | Later |  |

### H. For DotPe (please forward to your DotPe contact)

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q46 | Who is our technical contact at DotPe? | Name | Before start |  |
| Q47 | Is there one Rista account for all brands, or a separate account for each client? | Short answer | Before start |  |
| Q48 | Does DotPe charge for API access? If yes, how much, and who pays? | Short answer | Before start |  |
| Q49 | When will the API documentation and access keys be shared? | Short answer | Before start |  |
| Q50 | Can the Rista API do each of these? Please answer yes or no for each.<br>A) Read live orders<br>B) Read sales for a date range and branch<br>C) Update a dish's name, description, price, photo and availability<br>D) Set a different price per channel (Swiggy, Zomato, dine-in) | Yes / No for each | Before start |  |
| Q51 | Can Rista notify us instantly when a new order arrives, or must we check regularly? Is there a limit on how often we may check? | Short answer | Before start |  |
| Q52 | Since there is no test account: which dishes or which outlet may we use to try menu changes on the live account, and at what time of day? | Short answer | Before start |  |

## 7. Client, brand and outlet table

| Client (company) | Brand | Outlet / branch in Rista | Kitchen that cooks it | On Swiggy? | On Zomato? |
| --- | --- | --- | --- | --- | --- |
| *ABC Foods* | *Biryani Box* | *Indiranagar* | *Base Kitchen* | *Yes* | *No* |
|  |  |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

## 8. Roles: who can do what

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
| See the audit log (who did what) | Yes | No | No | No | No | No | ? | ? |
| Manage users and settings, delete records | Yes | No | No | No | No | No | ? | ? |
| New: see live Swiggy and Zomato orders | ? | ? | ? | ? | ? | ? | ? | ? |
| New: download sales reports | ? | ? | ? | ? | ? | ? | ? | ? |
| New: add or edit dishes, prices and photos | ? | ? | ? | ? | ? | ? | ? | ? |
| New: send menu changes to Rista | ? | ? | ? | ? | ? | ? | ? | ? |
| New: record production sent to an outlet | ? | ? | ? | ? | ? | ? | ? | ? |
| New: see the production and sales comparison | ? | ? | ? | ? | ? | ? | ? | ? |

Note: Yes = allowed today. No = not allowed today. "?" = please fill. Today everyone sees all brands and all kitchens on the screens they can open; questions Q18 and Q19 decide whether that changes.

## 9. Files we would like from you

- [ ] The client, brand and outlet table (Q13)
- [ ] The corrected roles table (Q15)
- [ ] A sales report you use today (Q26)
- [ ] The production and sales tracking sheet, with examples of mismatches (Q38)
- [ ] Real data to load: raw items, recipes, brands, suppliers, outlets (Q7)
- [ ] Swiggy or Zomato photo guidelines, if you have them (Q37)
- [ ] DotPe API documentation and access keys (Q49)

## 10. What happens next

Can start before DotPe is ready:

- Roles (R7): the final roles, and limiting people to their own kitchens and brands.
- Brand owner logins that only ever show their own brand.
- Sales reports limited to the person's own brand, with date range and branch selection.
- Catalog editing on our website (R4), including automatic photo shrinking to under 200 KB.
- Production and sales tracking (R6), using sales typed into the website until Rista sales arrive.
- Item search on the Production and Sales screens (decision 13).

Waits for DotPe:

- Live Swiggy and Zomato orders (R2).
- Importing Rista sales automatically (R3).
- Sending menu and price changes to Rista (R5).
