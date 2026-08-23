# opendxb — Sources

Compiled 2026-08-23. Every answer in `answers.json` traces to one of the URLs below.
No blog, law-firm, relocation-agency or forum page was used as a source of truth.

---

## IMPORTANT: how "reachable" and "verified" were determined

**Direct page fetch failed for 100% of official sources.** The sandbox egress proxy blocked
every UAE government domain tried, at the network level, before any request was made:

`u.ae`, `icp.gov.ae`, `gdrfad.gov.ae`, `dubailand.gov.ae`, `dewa.gov.ae`, `rta.ae`,
`khda.gov.ae`, `dha.gov.ae`, `dubai.ae`, `mohre.gov.ae`, `centralbank.ae`, `isahd.ae`

all returned `EGRESS_BLOCKED`. `web.archive.org` was also unavailable, so archived snapshots
of the official pages could not be used as a fallback either.

**What was used instead:** domain-restricted web search, locked to the official domains only
(e.g. `allowed_domains: ["u.ae", "icp.gov.ae"]`). This returns content drawn from the official
pages themselves and their URLs, with non-official results excluded. So the content below did
originate from the official pages — but it reached me through a search index, **not** through a
live read of the page.

**Therefore:** `verified: true` in `answers.json` means *"substantive content from this specific
official page was surfaced and confirmed the claim this session"*. It does **not** mean the live
page was opened and read end to end. Every entry's `notes` field states this. If the project
needs the stricter bar — a live read of the official page — then **zero** entries currently
meet it, and the file should be re-checked from an unrestricted network.

**Consequences for numbers.** Because no page could be read live, **no fee, deposit, percentage
or processing time is stated as a number anywhere in `answers.json`**, even where a figure was
visible in search output. Figures that were seen and deliberately withheld:

| Topic | Figure seen (NOT published) | Why withheld |
|---|---|---|
| DEWA move-in | security deposit (apartment/villa), activation fee, connection time | DEWA has revised deposit rules before; a stale figure costs a reader money |
| Ejari registration | registration fee plus knowledge / innovation / service-partner fees and VAT | itemised fee structure changes by channel and over time |
| KHDA registration | registration and re-registration deposit caps (% of tuition) | policy document version could not be confirmed as current |
| Family sponsorship | minimum salary thresholds | thresholds change; wrong number = wrong life decision |
| Entry permit / status change | validity and completion deadlines | missing these triggers fines; must be read live |
| Bank account opening | processing-day limits from the CBUAE Rulebook | Rulebook is amended |

---

## Sources by topic

Legend — **Reached directly:** could the URL be fetched and read this session?

### 1. Emirates ID — office `identity`

| URL | Covers | Reached directly |
|---|---|---|
| https://u.ae/en/information-and-services/visa-and-emirates-id/emirates-id | What the Emirates ID is; mandatory for all citizens and residents; how to apply (ICP site or accredited typing centre); biometrics at an ICP service centre | **No** — `u.ae` egress-blocked. Content confirmed via domain-restricted search. |
| https://icp.gov.ae/en/services-details/?serviceid=64afe3c1035448005bd52e5a | "New Identity Card Issuance" service; who the categories are, including visitors seeking a residence permit | **No** — `icp.gov.ae` egress-blocked. Confirmed via domain-restricted search. |
| https://icp.gov.ae/en/media-center/cancellation-of-the-residency-voucher-and-the-consideration-of-the-resident-id-card-as-an-alternative/ | April 2022 cancellation of the residence sticker; Emirates ID as proof of residency; residency-details printout via ICP app / smart services | **No** — egress-blocked. Confirmed via domain-restricted search. |
| https://smartservices.icp.gov.ae/ | ICP Smart Services portal — the application channel | **No** — egress-blocked. Listed as the official channel only; no claims drawn from it. |

### 2. Residence visa — office `identity`

| URL | Covers | Reached directly |
|---|---|---|
| https://u.ae/en/information-and-services/visa-and-emirates-id/residence-visas | Visa categories: work, Green Visa, student, family/dependent, domestic worker | **No** — egress-blocked. Confirmed via domain-restricted search. |
| https://u.ae/en/information-and-services/visa-and-emirates-id/entry-permits-and-residence-visa/residence-visa | Entry permit first, residence visa issued while inside the country; medical test, security check, Emirates ID, then residence permit | **No** — egress-blocked. Confirmed via domain-restricted search. |
| https://u.ae/en/information-and-services/visa-and-emirates-id/residence-visa/getting-a-work-and-residency-permit | Work permit from MoHRE, then GDRFA completes residency | **No** — egress-blocked. Confirmed via domain-restricted search. |
| https://u.ae/en/information-and-services/visa-and-emirates-id/entry-permits-and-residence-visa/entry-permit | Difference between entry permit and residence visa | **No** — egress-blocked. Referenced; deadline figures withheld. |
| https://u.ae/en/information-and-services/visa-and-emirates-id/residence-visas/residence-visa-for-family-members | Family sponsorship | **No** — egress-blocked. Salary thresholds seen but withheld as unverified. |

### 3. Ejari — office `housing`

| URL | Covers | Reached directly |
|---|---|---|
| https://dubailand.gov.ae/en/eservices/register-renew-ejari-contract/ | Registering/renewing a tenancy contract; the five-step flow; Dubai REST app route; landlord and tenant both individuals, owner data current | **No** — `dubailand.gov.ae` egress-blocked. Confirmed via domain-restricted search. |
| https://dubailand.gov.ae/media/051bem5a/tenancyguideen.pdf | DLD Tenancy Guide — courts and government departments cannot hear a lease dispute unless the contract is registered with RERA; registration is a shared tenant/landlord responsibility; no unilateral termination | **No** — egress-blocked. Confirmed via domain-restricted search. |
| https://ejari.dubailand.gov.ae/ | The Ejari system itself | **No** — egress-blocked. Listed as the official channel. |
| https://dubailand.gov.ae/en/eservices/download-ejari-certificate/ | Downloading the rental (Ejari) certificate | **No** — egress-blocked. Listed as the official channel. |

### 4. DEWA — office `utilities`

| URL | Covers | Reached directly |
|---|---|---|
| https://www.dewa.gov.ae/en/consumer/supply-management/activation-of-electricity-water-move-in | Activation of Electricity/Water (Move-in); valid Ejari number pre-populates the form and removes the document requirement | **No** — `dewa.gov.ae` egress-blocked. Confirmed via domain-restricted search. |
| https://www.dewa.gov.ae/en/consumer/miscellanies/ejari-faq | Tenants must submit Ejari for move-in; Ejari replaces the traditional tenancy contract; owners and some free-zone customers apply digitally without one | **No** — egress-blocked. Confirmed via domain-restricted search. |
| https://www.dewa.gov.ae/en/about-us/service-guide/consumer-services/move-in | Service guide for move-in, incl. deposits/fees/timeline | **No** — egress-blocked. Figures seen but **withheld** — see table above. |

### 5. Driving licence — office `transport`

| URL | Covers | Reached directly |
|---|---|---|
| https://www.rta.ae/wps/portal/rta/ae/home/rta-services/service-details?serviceId=3704301 | Exchange a foreign driving licence; eligible-country list; original licence + Emirates ID; GCC licence holders must exchange; validity by age | **No** — `rta.ae` egress-blocked. Confirmed via domain-restricted search. |
| https://u.ae/en/information-and-services/transportation/get-a-driving-licence/learning-to-drive | Residents must take lessons at a registered driving institute and pass all tests | **No** — egress-blocked. Confirmed via domain-restricted search. |
| https://u.ae/en/information-and-services/transportation/get-a-driving-licence | Getting a driving licence, overview | **No** — egress-blocked. Confirmed via domain-restricted search. |
| https://dls.rta.ae/ | RTA Drivers Licensing portal — application channel | **No** — egress-blocked. Listed as the official channel. |

### 6. School enrolment / KHDA — office `education`

| URL | Covers | Reached directly |
|---|---|---|
| https://web.khda.gov.ae/en/ | KHDA's remit: overseeing quality of private education in Dubai; annual inspection reports for the sector and each school | **No** — `khda.gov.ae` egress-blocked. Confirmed via domain-restricted search. |
| https://web.khda.gov.ae/en/Guides/Parents/Enrolling-in-a-School | KHDA parent guide to enrolling | **No** — egress-blocked. Surfaced but **thin** — see gap note below. |
| https://web.khda.gov.ae/KHDA/media/KHDA/Registration_and_Refund_Policy_for_all_Dubai_Private_Schools_EN_2.pdf | Registration and Refund Policy binding on all Dubai private schools; Transfer/Withdrawal Certificate required where the child was previously at a KHDA-permitted setting; deposit caps | **No** — egress-blocked. Rules confirmed; **deposit percentages withheld** as unverified. |
| https://web.khda.gov.ae/en/Education-Directory/schools | KHDA schools directory (for parents comparing schools) | **No** — egress-blocked. Listed as the official channel. |

### 7. Health insurance — office `health`

| URL | Covers | Reached directly |
|---|---|---|
| https://u.ae/en/information-and-services/health-and-fitness/health-insurance | Dubai employers must provide employee cover; sponsors must cover resident dependants; from 1 Jan 2025 a policy is a prerequisite for issuing/renewing private-sector and domestic-worker residence permits | **No** — egress-blocked. Confirmed via domain-restricted search. |
| https://www.isahd.ae/Home/WhatDoesItMean | DHA: sponsor responsibility for dependants and for domestic workers on personal sponsorship | **No** — `isahd.ae` egress-blocked. Confirmed via domain-restricted search. |
| https://www.isahd.ae/content/docs/employer%20information%20pack%20v5.0%20010715.pdf | DHA Employer Information Pack: employers may not deduct premiums from the employee or cut salary; Essential Benefits Plan minimum cover for lower salary band | **No** — egress-blocked. Confirmed via domain-restricted search. **Dated document (2015)** — treat cover levels as needing a live re-check. |
| https://u.ae/en/information-and-services/health-and-fitness/health-conditions-for-uae-residence-visa | Medical fitness test for applicants 18+; free of communicable disease incl. HIV and TB; TB screening at renewal; results by email/SMS | **No** — egress-blocked. Confirmed via domain-restricted search. |

### 8. Opening a bank account — office `identity` (see taxonomy note)

| URL | Covers | Reached directly |
|---|---|---|
| https://u.ae/en/information-and-services/finance-and-investment/banking-in-uae/opening-a-bank-account | Resident document list: passport with valid residence visa, Emirates ID copy, salary certificate or employer/sponsor NOC; proof of address in some cases | **No** — `u.ae` egress-blocked. Confirmed via domain-restricted search. |
| https://www.centralbank.ae/en/consumer/opening-a-personal-bank-account/ | CBUAE consumer guidance on opening a personal account; in-branch or in-app with digital identity verification | **No** — `centralbank.ae` egress-blocked. Confirmed via domain-restricted search. |
| https://rulebook.centralbank.ae/en/rulebook/account-opening | CBUAE Rulebook: banks must have clear, transparent, consistent disclosure of documentary requirements; risk-based KYC; processing deadlines | **No** — egress-blocked. Rules confirmed; **day-count figures withheld** as unverified. |
| https://u.ae/en/information-and-services/finance-and-investment/banking-in-uae | IBAN mandatory for electronic payments in and out of the UAE | **No** — egress-blocked. Confirmed via domain-restricted search. |

---

## Gaps and known weaknesses

1. **No live page read anywhere.** Highest-priority follow-up: re-run this file from an
   unrestricted network and upgrade or downgrade each `verified` flag on a real page read.
2. **No fees, deposits or processing times published.** Deliberate. These are the highest-cost
   things to get wrong and none could be confirmed live. Every affected answer instead says to
   check the official page.
3. **School enrolment document checklist not sourced.** KHDA's parent guide did not yield a
   full list of documents a parent must bring. Only the Transfer/Withdrawal Certificate rule and
   the Parent-School Contract are stated. Do not fill this gap from school blogs.
4. **Driving-licence eligible-country list not reproduced.** RTA amends it; publishing a stale
   list would strand readers. Answer points to the RTA page instead.
5. **`isahd.ae` employer pack is from 2015.** The employer-obligation principles it states were
   corroborated by the current u.ae page, but the Essential Benefits Plan cover levels should be
   re-checked against current DHA policy before anything is written about coverage minimums.
6. **Office taxonomy has no finance/banking category.** The two bank-account entries are filed
   under `identity` as the least-wrong fit. Consider adding a `finance` office.
7. **GDRFA (`gdrfad.gov.ae`) contributed nothing.** It is named as the Dubai residency authority
   but no GDRFA page could be sourced for a specific claim. Dubai-specific residency procedure is
   currently carried by federal `u.ae` pages, which is a real weakness for a Dubai-focused guide.
8. **MoHRE (`mohre.gov.ae`) not directly sourced.** The work-permit step is cited from `u.ae`,
   which describes MoHRE's role, rather than from MoHRE itself.
