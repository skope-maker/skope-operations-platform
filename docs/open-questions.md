# Skope Operations Platform: Next phase: requirements, decisions and questions

*Prepared by Youvraj · 20 October 2026 · Version 2*

> The Word version (`Skope-Next-Phase-Questions-v2.docx`) is the one sent to the team. This file holds the same content so it can be read and diffed in git. Both are generated from one source.

## 1. About this document

The team asked for seven changes to the operations website. Before building them, we need a few answers so that we build the right thing the first time.

This version also uses what we learned on 19 October from the Rista portal and from one month of Rista sales data (section 3). Several questions are now answered from that data, and the remaining ones are more specific.

The document has four parts: what was requested, what we learned from Rista, the technical decisions we have already made (you only agree or disagree), and the questions only your team can answer.

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

## 3. What we learned from Rista

On 19 October we went through the Rista portal with Keshava and downloaded one month of sales ("Sales Items By Transaction", 19 September to 19 October 2026). On 20 October we also downloaded the full menu ("Export Items") and one month of cancelled orders ("Cancelled Transactions"). The numbers below come from those three files. Customer names and phone numbers in them were not copied anywhere.

| Topic | What we found |
| --- | --- |
| Orders | 6,520 orders (13,829 item lines) in 31 days, about 210 orders a day. |
| Sales | ₹20.35 lakh net, after ₹2.30 lakh of discounts (₹22.65 lakh before discounts). |
| Where orders come from | Zomato 44%, Swiggy 40%, Ownly 8%, in-store (POS) 8% of net sales. |
| Branches | Rista has 5 branches. All sales came from 2 of them: JP Nagar and Marathahalli, both marked "Outlet". The menu also has prices for Jayanagar, Kalyan Nagar and Koramangala, which look like the other 3. |
| Brands | 13 brands sell from those 2 branches. Kochi Kurry Klub alone is 72% of sales (section 8 lists all of them). |
| Channels | 33 channel names, each tied to a brand, for example "Zomato(Kochi Kurry Klub)" or "Swiggy - Eleven Bakehouse", plus "ODC" and "Offline - JP Nagar". |
| Brand on each sale | Each line has a "Business Brand" and an "Account Name", and they do not always match. For example, some Kochi Kurry Klub sales carry the account names Al Mashawi Shawarma, Chicbun, Corporate Menu or ODC Event. The Account Name is always the brand that owns the dish in the menu (all 11,498 matched lines agree), so the Business Brand seems to be the brand the customer ordered from. |
| Dishes | 375 dish codes (SKUs such as GIA001). Lines are dishes, options or add-ons, some with sizes (100 ml, Serves 1-2). |
| Menu (export) | 1,507 dishes (1,465 active) in 144 categories under 25 brand accounts, 196 of them with sizes. Only 340 active dishes sold in the month. 8 brands have a menu but no sales: Punjabi House, Bao Bangalore, Kritunga, Chaat-GPT, Saladeo, The Big Biryani Theory, Pynch and Swanky Spoon Society. |
| Prices | Each dish can have a different price for each branch and channel (224 price columns, for example "JP Nagar: Swiggy(Kochi Kurry Klub)"), and can be switched off per channel. |
| Matching sales to the menu | Every dish sold matches the menu by its code, except 2 codes (114 and GIA013, 25 lines). Options and add-ons are not in this export; they are in Rista's separate Add-Ons list. |
| Business day | Every sale already has a Rista "Business Date", separate from the exact invoice time. |
| Costs in Rista | Rista records a materials cost on some lines (3,629 of 13,829), so Rista's own inventory may be in use. |
| Customer details | A name and phone number appear on 787 lines (6%). |
| Cancelled orders | 77 in the month (about 1 in 85 orders, ₹27,830), none of them in the sales file. 69 were cancelled automatically by Zomato, Swiggy or Ownly (customer cancelled, no delivery partner, out of stock); 8 were cancelled by staff, mostly "Wrongly Punched". The report says how far the order got before it was cancelled. |
| Report limits | On screen, reports show at most 7 days (1 to 8 branches, depending on the report). Downloads are not limited: one download covered a whole month and all branches. Some exports, like the menu, are emailed to datamanagement@skopekitchens.com instead of downloaded. |
| Menu (catalog) | Dishes have a photo, veg or non-veg tag, code and price, and can be marked unavailable. Rista has bulk "Upload Items", "Upload Item Price", "Bulk Image Update" and "Export Items", a "Price book" for channel prices, a "Display Book" per channel and branch, item options and item schedules. |
| Live order board | Online orders move through New, Accepted / Preparing, Prepared, Processed, Dispatched, Delivered and Cancelled, with advance orders and separate online and offline tabs. |
| Dine-in | There is a table view (20 tables) and a point-of-sale screen for dine-in orders. |
| People in Rista | Rista uses accounts per branch such as "Dispatcher JP Nagar" and "Manager Mhalli". |

### What this means for the build

- A brand is not the same as an outlet: one branch cooks many brands. Client logins must be limited by brand, not by branch.
- We must agree which field decides who owns a sale (Business Brand or Account Name), otherwise a client could see another brand's sales (Q15).
- Ownly and in-store sales are 16% of sales. The request mentions only Swiggy and Zomato, so we need to know whether to include them (Q26).
- Until the API is ready, reports can start from one monthly Rista download covering all branches.
- Dish codes already link sales to the menu, so matching sales to our recipes is reliable.
- Prices differ by branch and channel, so catalog editing must handle more than one price per dish (Q39).
- Rista already supports bulk Excel uploads, so menu changes have a fallback even if the API is limited.
- If Rista's inventory is in use, we must avoid keeping stock in two places (Q34).
- About 210 orders a day is a small volume: modest paid hosting will be enough.

## 4. Decisions we have made

Write Yes if you agree, or No with a short reason.

| No. | Topic | Our decision | Agree? |
| --- | --- | --- | --- |
| 1 | Where the new features are built | In this app, the Skope Operations Platform (test copy: skope-operations-platform.onrender.com), on top of what already works. |  |
| 2 | Working on the live DotPe account | There is no test account, so we start by only reading from Rista (orders, sales, menu). We change the menu only on dishes or a branch you choose for testing, at times you agree. Every change we send is recorded together with the old value, so it can be undone. |  |
| 3 | How fresh live orders are | As live as DotPe allows: instantly if Rista can notify us, otherwise checked every minute. |  |
| 4 | Order steps shown | The same steps as Rista's order board: New, Accepted / Preparing, Prepared, Dispatched, Delivered, Cancelled. |  |
| 5 | Order history | The last 30 days are shown by default. Older orders can be found by choosing dates. |  |
| 6 | Business day | Every sale is counted on Rista's own "Business Date", so our reports always match Rista. |  |
| 7 | Importing sales | Until the API is ready: an admin uploads Rista's downloaded sales file (one month, all branches) and the website loads it, skipping lines it already has. Once the API is ready: every night for the previous day, plus a "refresh now" button for admins. |  |
| 8 | Cancelled and refunded orders | Taken from Rista's "Cancelled Transactions" report, listed separately with the reason, and left out of sales totals (Rista already leaves them out). |  |
| 9 | Matching Rista dishes to our recipes | By Rista's dish code (SKU, for example GIA001), checked against the menu export. Options and add-ons are linked to the dish they were sold with. Codes that do not match are listed for an admin to fix. |  |
| 10 | Report downloads | Excel and CSV. |  |
| 11 | Photos over 200 KB | The website shrinks them automatically before saving, so owners do not need to resize anything. JPG, PNG and WebP accepted. |  |
| 12 | Which side is correct for menu details | Our website. If someone changes a dish directly in Rista, the website shows the difference so a person can decide. It never overwrites silently. |  |
| 13 | Channel prices | Keep one price per branch and channel, exactly as Rista does, and send them through Rista's price settings if the API allows it. |  |
| 14 | Fallback for menu changes | If Rista's API cannot change dishes, the website prepares Rista's own "Upload Items" and "Upload Item Price" Excel files for someone to upload. |  |
| 15 | Failed changes to Rista | Retried automatically. If it still fails, both the person who made the change and the admin see it. |  |
| 16 | New-order alert | An on-screen alert with a sound, which each person can switch off. |  |
| 17 | Forgotten passwords | A "Forgot password" link that sends an email. The admin can still reset passwords. |  |
| 18 | One person with several roles | Allowed. |  |
| 19 | Customer details | We do not store customer phone numbers or addresses, even though Rista has them on some sales, to follow data protection rules and reduce risk. |  |
| 20 | Item search on more screens | The same search box will also be added where sub-recipes are picked (Production) and dishes are picked (Sales). |  |
| 21 | The Issue step | Stays as it is: the store issues exactly what the kitchen requested, so nobody picks items there. |  |
| 22 | Hosting before real clients use it | Move from the free test setup to paid hosting with daily backups and permanent photo storage. About 210 orders a day is small, so a modest plan is enough. We will share the monthly cost for approval first. |  |
| 23 | Security before real clients use it | Remove the demo logins from the login page, require strong passwords, accept requests only from our own website, and stop putting login keys inside attachment links. |  |
| 24 | Running alongside the old sheets | Keep the current sheets for two weeks after each part goes live, to compare results. |  |
| 25 | Progress updates | A message whenever a part is ready to test, plus a short weekly call. |  |

## 5. Working with DotPe Rista without a test account

- Read first: during building we only read orders, sales and the menu from Rista. Reading cannot change anything.
- Write carefully: menu and price changes are tried only on dishes or a branch you choose, at an agreed time, with someone from your team watching.
- Undo is always possible: every change we send is saved with the value it replaced.
- No surprises: nothing is sent to Rista automatically until you have tested it and agreed.
- A fallback exists: Rista's own Excel upload for items and prices can be used if the API cannot change the menu.

## 6. Words we use

| Word | What we mean | Correction |
| --- | --- | --- |
| Client | A company or person who owns one or more brands and logs in to see only their own data. |  |
| Brand | A food brand sold to customers, for example Kochi Kurry Klub. Rista sales carry both a "Business Brand" and an "Account Name" (see Q15). |  |
| Branch (outlet) | A place that cooks and sells, as set up in Rista. Today sales come from JP Nagar and Marathahalli. One branch sells many brands. |  |
| Kitchen or location | A place in our website that holds stock: Main Store, Base Kitchen, Normal Kitchen, R&D Kitchen. |  |
| Channel | Where a customer orders: Swiggy, Zomato, Ownly, or in-store (POS). |  |
| Dish (menu item) | Something a customer orders, with a price and a Rista code (SKU). In our website today these are called "recipes". |  |
| Raw item | An ingredient we buy and stock, for example onion or oil. In our website today these are called "items". |  |

## 7. Questions for your team

### A. Project basics

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q1 | The company's database account also holds data from another app (orders, item masters, ingredient indents, menu entries). Which app is that, and is it still in use? We ask so we do not rebuild something that already exists. | Short answer | Later |  |
| Q2 | Is anything missing or wrong in section 2, "What was requested", or in section 3, "What we learned from Rista"? | Short answer | Before start |  |
| Q3 | Put the requests in order, most important first: R2 live orders, R3 sales reports, R4 catalog management, R5 catalog sync, R6 production and sales tracking, R7 roles. | Short answer | Before start |  |
| Q4 | Is there a target date for the first part to be ready? | Short answer | Before start |  |
| Q5 | Who makes the final decision when people give different answers? | Name | Before start |  |
| Q6 | Who will test each finished part and confirm it is correct? | Name | Before start |  |
| Q7 | Is real data ready to load into our website (raw items, recipes, suppliers)? The website has Excel upload templates for this. | Yes / No (and Send a file) | Before start |  |
| Q8 | Who approves the monthly cost of paid hosting (see the decision "Hosting before real clients use it")? | Name | Later |  |
| Q9 | Who manages the company's domain, so the live site can have an address like ops.skopekitchens.com? | Name | Later |  |

### B. Clients, brands and branches

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q10 | Are the meanings in section 6, "Words we use", right? Correct any that are wrong. | Fill the table | Before start |  |
| Q11 | In catalog management (R4), does "item" mean a dish customers order, not a raw ingredient? | Yes / No | Before start |  |
| Q12 | Section 8 lists the 13 brands with sales and the 8 brands that have a menu but no sales this month. Please add the client company that owns each brand, mark any brand that has stopped, and correct anything wrong. | Fill the table | Before start |  |
| Q13 | Rista has 5 branches, but all sales came from JP Nagar and Marathahalli. The menu also has prices for Jayanagar, Kalyan Nagar and Koramangala. Are those the other 3, and are any of them still used or opening again? | Short answer | Before start |  |
| Q14 | Should JP Nagar and Marathahalli become locations in our website, so stock and production can be tracked there? Which of our kitchens supplies each of them? | Short answer | Before start |  |
| Q15 | Each sale has a "Business Brand" and an "Account Name", and they do not always match (see section 3). The data suggests the Business Brand is the brand the customer ordered from, and the Account Name is the brand that owns the dish. Which one decides who owns a sale, and therefore which client can see it?<br>A) Business Brand (the brand the customer ordered from)<br>B) Account Name (the brand that owns the dish)<br>C) Something else (please explain) | Pick one | Before start |  |
| Q16 | What are Chicbun, Corporate Menu, ODC Event, General and The Good Fud? They appear as account names in Rista but never as the brand of a sale. Is "The Good Fud" the same as "The Healthy Fud"? | Short answer | Before start |  |
| Q17 | Can one client own more than one brand? | Yes / No | Before start |  |

### C. Roles and access

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q18 | Correct and complete the roles table in section 9. Change any cell that is wrong and fill the cells marked "?". | Fill the table | Before start |  |
| Q19 | Which roles do you want in the end, and who will hold each one? Keep, rename or remove any of today's six roles (Admin, Procurement manager, Store keeper, Store manager, Chef, Management). | Short answer | Before start |  |
| Q20 | "Store staff" was mentioned. Which is it?<br>A) The same as our Store keeper<br>B) A new role for staff at a branch, like Rista's "Dispatcher JP Nagar" and "Manager Mhalli" accounts<br>C) Something else (please describe) | Pick one | Before start |  |
| Q21 | Today everyone sees all kitchens on the screens they can open. Should our staff see only the kitchen or branch they work at?<br>A) No, staff see all of them (as today)<br>B) Yes, each person sees only their own<br>C) Only some roles are limited (please say which) | Pick one | Before start |  |
| Q22 | Should our staff see only the brands they handle?<br>A) No, staff see all brands<br>B) Yes, only the brands they handle | Pick one | Before start |  |
| Q23 | Besides live orders and sales reports, what else should a brand owner see?<br>A) Stock<br>B) Recipes and costs<br>C) Wastage<br>D) Production sent to their branches<br>E) Nothing else | Tick | Before start |  |
| Q24 | Who creates logins for new people?<br>A) Only the admin<br>B) The admin, and each brand owner for their own staff | Pick one | Before start |  |
| Q25 | About how many people will log in? Give a number for each: our staff, brand owners, brand owners' staff. | Number | Later |  |

### D. Live orders (R2)

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q26 | Which orders should clients see? (Ownly and in-store are 16% of sales.)<br>A) Swiggy<br>B) Zomato<br>C) Ownly<br>D) In-store (POS), including ODC | Tick | Before start |  |
| Q27 | Which details should be shown for each order? (Customer phone numbers and addresses are not stored, see the decision "Customer details".)<br>A) Order number<br>B) Time<br>C) Channel<br>D) Dishes, options and quantities<br>E) Amount and discount<br>F) Status<br>G) Customer name<br>H) Preparation and dispatch time | Tick | Before start |  |
| Q28 | Orders are accepted on Rista's order board today. On our website, should clients only look at orders, or also act on them?<br>A) Only look<br>B) Also accept, reject or mark as ready | Pick one | Before start |  |
| Q29 | Should our own team (admin, management) see live orders for all brands? | Yes / No | Before start |  |

### E. Sales reports (R3)

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q30 | The file you downloaded ("Sales Items By Transaction") has 82 columns and one line per dish. What should clients get?<br>A) The same line-by-line detail, with fewer columns<br>B) A daily summary by channel<br>C) Both | Pick one | Before start |  |
| Q31 | Which money columns should clients see? The data has gross amount, discounts, net amount, taxes, tax collected by Swiggy or Zomato, and packaging or other charges. Platform commission is not in it. | Short answer | Before start |  |
| Q32 | Should a client be able to choose a branch, or always see all branches for their brand together?<br>A) Choose a branch<br>B) Always all branches together<br>C) Both | Pick one | Later |  |
| Q33 | Today, daily sales are typed into our website and posting them uses up ingredients from stock through the recipes. When Rista sales come in automatically, should they do the same?<br>A) Yes: Rista sales replace typing and use up stock automatically<br>B) No: Rista sales are only for reports; stock stays as it is today<br>C) Not sure yet, discuss in the walkthrough | Pick one | Before start |  |
| Q34 | Rista also has an Inventory section and records a materials cost on some sales. Where should stock be kept?<br>A) Only in our website<br>B) Only in Rista<br>C) Both (please say which one is correct when they differ) | Pick one | Before start |  |
| Q35 | If you chose A in Q33, each of the 375 Rista dish codes needs a recipe in our website. Who can confirm those recipes? | Name | Before start |  |

### F. Catalog management (R4)

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q36 | What may brand owners do?<br>A) Add new dishes and edit existing ones<br>B) Only edit existing dishes | Pick one | Before start |  |
| Q37 | Besides name, description, price and photo, which fields should owners be able to change? (Rista already has all of these.)<br>A) Category<br>B) Veg, non-veg or egg<br>C) Sizes (for example Serves 1-2)<br>D) Options and add-ons<br>E) Available or out of stock<br>F) Time schedule (when a dish is shown)<br>G) Other (please list) | Tick | Before start |  |
| Q38 | Should a change go live straight away, or be checked first?<br>A) Live straight away<br>B) Our admin approves it first | Pick one | Before start |  |
| Q39 | The menu has a separate price for each branch and channel (for example, at JP Nagar the Puttu + Kadala Curry Combo is ₹129 for takeaway, ₹149 in-store and ₹185 on Swiggy and Zomato). How should brand owners change prices?<br>A) Edit each branch and channel price separately<br>B) Edit one base price; channel prices follow a fixed rule (please give the rule)<br>C) Only our admin changes prices | Pick one | Before start |  |
| Q40 | When a brand owner adds a new dish, must it also get a recipe in our website, so stock is used up when it sells? | Yes / No | Before start |  |
| Q41 | If you have Swiggy or Zomato photo guidelines (shape, minimum size), please send them. | Send a file | Later |  |

### G. Production and sales tracking (R6)

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q42 | Please send the sheet the team uses today, with real examples where the quantity sent did not match sales. | Send a file | Before start |  |
| Q43 | What is sent to the branches?<br>A) Finished dishes, counted in portions<br>B) Prepared bases or sub-recipes, counted in kg or litres<br>C) Both | Pick one | Before start |  |
| Q44 | Who records what was sent, and who records what arrived at the branch? | Short answer | Before start |  |
| Q45 | Do branches count what is left at the end of the day? | Yes / No | Before start |  |
| Q46 | Our website already has a daily closing that compares the expected stock with the counted stock at a kitchen. Is that similar to what you need? | Short answer | Before start |  |
| Q47 | Above what difference should the website warn someone? Give a percentage. | Number | Later |  |
| Q48 | Who should be warned, and how?<br>A) A message on the website<br>B) Email<br>C) WhatsApp | Tick | Later |  |
| Q49 | List the usual reasons for a mismatch, for example wastage, staff meals, complimentary, wrong entry. | Short answer | Later |  |

### H. For DotPe (please forward to your DotPe contact)

| No. | Question | How to answer | Needed | Your answer |
| --- | --- | --- | --- | --- |
| Q50 | Who is our technical contact at DotPe? | Name | Before start |  |
| Q51 | Is there one Rista account for all brands, or a separate account for each client? | Short answer | Before start |  |
| Q52 | Does DotPe charge for API access? If yes, how much, and who pays? | Short answer | Before start |  |
| Q53 | When will the API documentation and access keys be shared? | Short answer | Before start |  |
| Q54 | Can the Rista API do each of these? Please answer yes or no for each.<br>A) Read live online orders and their status<br>B) Read sales item by item for a date range and branch (like "Sales Items By Transaction")<br>C) Read cancelled transactions<br>D) Update a dish's name, description, price and availability<br>E) Upload or change a dish photo<br>F) Set a different price for each branch and channel<br>G) Read the full menu (today "Export Items" only arrives by email) | Yes / No for each | Before start |  |
| Q55 | Can Rista notify us instantly when a new order arrives, or must we check regularly? Does the API have limits on dates or branches, like the screen (7 days per report)? | Short answer | Before start |  |
| Q56 | Since there is no test account: which dishes or which branch may we use to try menu changes on the live account, and at what time of day? | Short answer | Before start |  |

## 8. Brands, branches and clients

Taken from the sales data (19 September to 19 October 2026) and the menu export. The last 8 brands have a menu in Rista but no sales this month. Please fill in the client company that owns each brand (question Q12), mark any brand that has stopped, and correct anything wrong. Add any brand that is missing.

| Brand (Rista) | Branches | Channels | Orders (31 days) | Share of sales | Client company that owns it | Correction |
| --- | --- | --- | --- | --- | --- | --- |
| Kochi Kurry Klub | JP Nagar, Marathahalli | Zomato, Swiggy, In-store (POS), Ownly | 4738 | 71.8% |  |  |
| Al Mashawi Shawarma | JP Nagar, Marathahalli | Zomato, Swiggy, Ownly | 754 | 11.1% |  |  |
| Anki's Dum Biryani | Marathahalli | Swiggy, Zomato | 445 | 4.2% |  |  |
| Eleven Bakehouse | JP Nagar | Swiggy, Zomato, Ownly | 165 | 3.7% |  |  |
| Me and Mo | Marathahalli | Swiggy, Zomato, Ownly | 120 | 3.4% |  |  |
| Malabar Flavors | JP Nagar | Swiggy, Zomato, Ownly | 71 | 1.6% |  |  |
| Pet Fresh Kitchen | JP Nagar | In-store (POS) | 7 | 1.5% |  |  |
| Skope Cafe | JP Nagar, Marathahalli | In-store (POS) | 125 | 1.4% |  |  |
| WrapOClock | Marathahalli | Zomato, Swiggy | 28 | 0.5% |  |  |
| Gredo Foods | JP Nagar | Ownly, Zomato, Swiggy | 25 | 0.3% |  |  |
| Doughpamine Kitchen | JP Nagar | Zomato, Swiggy | 18 | 0.2% |  |  |
| The Healthy Fud | JP Nagar | Zomato, Swiggy | 17 | 0.2% |  |  |
| GIA FOODS | Marathahalli | Zomato, Swiggy | 7 | 0.1% |  |  |
| Punjabi House | None this month | Menu only (169 dishes), no sales | 0 | 0% |  |  |
| Bao Bangalore | None this month | Menu only (67 dishes), no sales | 0 | 0% |  |  |
| Kritunga | None this month | Menu only (45 dishes), no sales | 0 | 0% |  |  |
| Chaat-GPT | None this month | Menu only (43 dishes), no sales | 0 | 0% |  |  |
| Saladeo | None this month | Menu only (11 dishes), no sales | 0 | 0% |  |  |
| The Big Biryani Theory | None this month | Menu only (10 dishes), no sales | 0 | 0% |  |  |
| Pynch | None this month | Menu only (8 dishes), no sales | 0 | 0% |  |  |
| Swanky Spoon Society | None this month | Menu only (5 dishes), no sales | 0 | 0% |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

## 9. Roles: who can do what

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
| New: record production sent to a branch | ? | ? | ? | ? | ? | ? | ? | ? |
| New: see the production and sales comparison | ? | ? | ? | ? | ? | ? | ? | ? |

Note: Yes = allowed today. No = not allowed today. "?" = please fill. Today everyone sees all brands and all kitchens on the screens they can open; questions Q21 and Q22 decide whether that changes.

## 10. Files we would like from you

- [ ] The brand table with client companies (Q12)
- [ ] The corrected roles table (Q18)
- [ ] The production and sales tracking sheet, with examples of mismatches (Q42)
- [ ] Real data to load: raw items, recipes, suppliers (Q7)
- [ ] Swiggy or Zomato photo guidelines, if you have them (Q41)
- [ ] DotPe API documentation and access keys (Q53)

## 11. What happens next

Can start before DotPe is ready:

- Roles (R7): the final roles, and limiting people to their own branches and brands.
- Brand owner logins that only ever show their own brand.
- Sales reports limited to the person's own brand, with date range and branch selection, first from a monthly Rista download covering all branches, then automatically once the API is available. Cancelled orders shown separately.
- Catalog editing on our website (R4), including automatic photo shrinking to under 200 KB.
- Production and sales tracking (R6), using sales typed into the website or loaded from Rista files until the API is available.
- Item search on the Production and Sales screens.

Waits for DotPe:

- Live Swiggy and Zomato orders (R2).
- Importing Rista sales automatically every night (R3).
- Sending menu and price changes to Rista (R5).
