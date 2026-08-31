# Templates for FinDock Payment Experiences

This repository is an overview of the templates we offer for building Salesforce-native digital experiences with [FinDock Payment Experiences.](https://docs.findock.com/docs/july-26/payments/findock-payment-experiences) There are three types of templates:

* **Site template**: a full Experience Cloud site template that that leverages our Flow templates (deployed separately) and managed Lighting Web Components (LWCs)   
* **Flow template**: a complete Flow for setting up a payment using our managed LWCs  
* **LWC template**: LWC template for building digital experiences without Flows

All templates are meant to be a starting point for your own configuration or custom development to fit specific use cases, branding, etc.

Out-of-the-box, all templates are:
- Accessible and WCAG compliant
- Fully localizable (language, currency, payment methods, etc.)
- Configurable to support multi-currency
- Configurable to support payment methods through FinDock native processing and integrated Payment Service Providers
- Fully extendable with Salesforce technology and clouds

If you prefer to build a fully custom implementation, on Salesforce or outside of Salesforce, please see our [custom Experience Cloud implementation repository](https://github.com/FinDockLabs/findock-experience-cloud-examples) or our [Payment API documentation](https://docs.findock.com/api/payment-api-v2).

## Available templates

**Membership, Subscription, Commerce, etc.**
- [Checkout flow](sfdx-source/packages/checkout): a simple Flow template for creating a payment form  
- [Checkout site](sfdx-source/packages/checkout-site): Experience Cloud site template that implements the Checkout flow template

**Fundraising**
- [Donation flows for Fundraising](sfdx-source/packages/donation-fundraising): Multi-screen Flow template for collecting donations in orgs with Fundraising enabled (NPC, EDU)  
- [Donation flows for Fundraising UK](sfdx-source/packages/donation-fundraising-uk): Multi-screen Flow template for collecting donations and Gift Aid in orgs with Fundraising enabled (NPC, EDU)  
- [Donation flows for NPSP](sfdx-source/packages/donation-npsp): single and multi-screen Flow templates for collecting donations in orgs with NPSP
- [Donation site](sfdx-source/packages/donation-site) Experience Cloud site template that implements the Donation flows for Fundraising and NPSP templates

**Any use-case**
- [LWC](sfdx-source/packages/lwc-procode): pro-code template for custom LWCs when you need full code control over layout, validation, navigation, etc. without using Flow. Components integrate with FinDock Payment API and are fully configurable.

## Package compatibility

Template packages that include shared components are mutually exclusive, so install only one such variant per org. Checkout is the exception and can coexist with another variant because it contains no shared components.


## Experience Cloud & Guest User Setup

The steps below apply to every payment template in this project family — Flow-based or LWC-based — for any page that needs to accept payments from unauthenticated (guest) users. Each sub-repo's README links back here instead of repeating these steps.

1. Follow [these instructions](https://help.salesforce.com/s/articleView?id=experience.rss_flow_guestuser.htm&type=5) to set up Guest User access for your Experience Cloud site.
2. The **FinDock Payer** permission set group must be assigned to the site's Guest User.
3. Go to Experience Cloud Administration → Preferences → enable **Allow guest users to access public APIs**.

Install the template package before deploying the site bundle — the site embeds the flow, which renders the shared components.

If any of these are missing, guest-user payments will fail at runtime even though the page renders correctly.

## Localizing FinDock Payment Experiences

The out-of-the-box FinDock Experience Cloud templates (donation flows, checkout flows, and pro-code payment forms) are built to be fully localizable out of the box. Every text string shown to a payer originates from a translatable source, while currencies and numbers are automatically formatted according to the payer's locale.

This guide is for administrators, business consultants, and Salesforce developers deploying FinDock payment templates who want to offer multi-language payment experiences.

> ℹ️ **INFO:** Localization relies on standard Salesforce capabilities: Translation Workbench, XLIFF Import, Experience Builder Languages, and CMS Content Translation. No custom FinDock configuration is required.

### How Localization Works

Payer-facing content in the templates is driven by four primary sources:

| Source | What it covers | How you translate it |
| --- | --- | --- |
| **Custom Labels (LWCs & Messages)** | All component labels (pay button, payment selector, amounts, error messages, progress stages). | Bulk update via the repo's `CustomLabels_template.xlf` file, then import to Translation Workbench. |
| **Experience Cloud Site Content** | Headers, footers, legal text, page titles, and CMS content. | Experience Builder (Settings → Languages → Export/Import Content) or standard LWR CMS translation. |
| **Flow Screen Text** | Screen headings, display text, and field labels defined inside template flows. | Translation Workbench → Flow (manual UI translation required; Salesforce rejects Flow imports via XLIFF). |
| **Picklist Values** | Field values rendered on screens (e.g., recurring payment frequencies). | Translation Workbench → Picklist Value. |

> ℹ️ **Automatic Locale Formatting:** Amounts, currencies, and numbers are not translated manually. They are dynamically formatted at runtime using `@salesforce/i18n` and `Intl.NumberFormat` based on the payer's locale (e.g., `€ 1.000,00` vs `$1,000.00`).

### Before You Begin

Before starting the translation process, ensure:

- Target languages are added and activated in Setup → Translation Language Settings.
- Translation Workbench is enabled, and your user is assigned as a translator for the target languages.
- You have access to Experience Builder for your site.

### Step-by-Step Translation Process

#### Step 1: Translate Custom Labels (XLIFF repo template)

Every FinDockLabs repository includes a pre-packaged template file — `CustomLabels_template.xlf` — containing all required LWC labels and core dependencies.

1. **Locate the template:** find `CustomLabels_template.xlf` in your repository (`/translations/`).
2. **Copy and rename:** create a copy of the file using your target language code (e.g., `CustomLabels_nl_NL.xlf`).
3. **Set target language:** open the file in an editor (VS Code, Notepad++), replace `TARGET_LANGUAGE_CODE` in the `target-language` attribute with your language code:

   ```xml
   <file original="Salesforce" source-language="en_US" target-language="nl_NL" translation-type="metadata" datatype="xml">
   ```

4. **Add translations:** enter translated values between `<target>` and `</target>` tags.
5. **Import to Salesforce:** go to Setup → Translation Workbench → Import, select your `.xlf` file, and upload it.

#### Step 2: Translate Site Content & CMS (Experience Builder)

Translate static page elements, footers, headers, and CMS articles:

1. In Experience Builder, go to Settings → Languages.
2. Add your target language(s).
3. Translate content:
   - **Directly in Builder:** switch to the target language in the top bar and edit text components on screen.
   - **Export/Import (LWR bulk):** export site content via Settings → Languages → Export Content, translate the generated XML/XLIFF file, and import it back.
4. Ensure the **Language Selector** component is placed in the header or navigation if you want guest users to switch languages manually.

#### Step 3: Translate Flow Screens (Salesforce Setup UI)

**Option A — Bulk translation via Export/Import (recommended for large flows):**

1. Go to Setup → Translation Workbench → Export.
2. Select **Bilingual** and click Export.
3. Locate the generated `.xlf` file in your unzipped download.
4. Search for `Flow.Flow.<YourFlowName>` tags (e.g., `Flow.Flow.Donation_Flow...`).
5. Translate the `<target>` strings and import the file back via Setup → Translation Workbench → Import.

**Option B — Manual UI translation (quickest for simple setups):**

1. Go to Setup → Translation Workbench → Translate.
2. Set **Setup Component** to Flow.
3. Select your Flow and enter translations for field labels and screen display text directly in the UI.

#### Step 4: Translate Picklist Values

1. Go to Setup → Translation Workbench → Translate.
2. Set **Setup Component** to Picklist Value.
3. Select the object and picklist field (e.g., Payment Frequency).
4. Enter translations so picklist choices match the payer's active language.

#### Step 5: Publish & Verify

1. Publish your Experience Cloud site.
2. Open the page in an incognito browser window as a guest user.
3. Switch to your target language (or navigate via the language URL prefix, e.g., `/nl/`).
4. Verify that Custom Labels, Flow screens, CMS text, and formatted amounts display correctly.

### Notes for Developers

If you are extending or customizing the FinDock payment templates:

- **Never hardcode user-facing strings:** always create a Custom Label (`$Label.c.your_label_name`) and reference it in your LWCs or Flow screens.
- **Keep Flow formulas translatable:** do not hardcode literal text inside Flow formulas. Use Custom Label references (`{!$Label.c.your_label_name}`) instead.
- **Use native i18n modules:** format currency and dates using `@salesforce/i18n` and JavaScript `Intl` utilities (`Intl.NumberFormat`, `Intl.DateTimeFormat`) to preserve automatic locale awareness.
