# Experience Cloud Payment LWC Templates

This template contains building blocks to help you build custom Lightning Web Components (LWC) for digital payment experiences using Experience Cloud and FinDock Payment Experiences. Use this template when you need full control over layout, validation, step, navigation, etc. Your custom LWC leverages the built-in capabilities of FinDock's [Payment Method Selector](https://docs.findock.com/docs/july-26/payments/payment-method-selector) and [Pay Button](https://docs.findock.com/docs/july-26/payments/pay-button) managed LWCs.

This is the code-first alternative to using our managed LWCs directly in Flows. For other options, see [Templates for FinDock Payment Experiences](https://github.com/FinDockLabs/experience-cloud-templates). 

## Deploy

Note: This deploys an example LWC wrapper around FinDock's components. Both out of the box components are part of the FinDock managed package and can be used without the code in this template.

<!-- INSTALL_LINK:START -->
**Install version 0.1.0-1:** [production or Developer org](https://login.salesforce.com/packaging/installPackage.apexp?p0=04tP4000001gLQrIAM) · [sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04tP4000001gLQrIAM)
<!-- INSTALL_LINK:END -->

## Components

| Component | Tag | Exposed | Purpose |
| --- | --- | --- | --- |
| `paymentForm` | `c-payment-form` | Yes | Drop-in payment form component that includes both `c-payment-selector` and `cpm-pay-button`. Replaces a payment Screen Flow. Configured via `@api` defaults in the code (see below). |
| `paymentSelector` | `c-payment-selector` | No | Pro-code wrapper around `cpm-payment-method-selector`. Accepts a simplified flat config and enriches it internally. Used by `paymentForm`; can also be embedded directly in custom LWC forms. |
| `currencyPicker` | `c-currency-picker` | No | Currency selector used inside `paymentForm`. Resolves the org's active currencies via the `CurrencyPickerController` Apex class, lets the payer choose when more than one is offered, and collapses to a fixed currency otherwise. |

### `c-payment-form` — Configuration Properties

These properties are set in code, on the `@api` defaults in `paymentForm.js` — they are **not** exposed in Experience Builder. Edit the defaults (or set them on the tag when embedding the form in a custom parent) to configure a deployment.

Out of the box, the payment form uses fixed amount and frequency values. The form displays them as read-only, and the payer fills in their contact details and picks a payment method (a fixed-checkout model). To let the payer choose the amount, fork the form or embed `c-payment-selector` in a custom LWC with your own input. The payer can choose the currency when more than one is offered (see `allowedCurrencies`).

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultCurrency` | String | `EUR` | ISO 4217 currency code (e.g. `EUR`, `USD`, `GBP`). The starting currency, and the fixed currency when only one is offered. An invalid, inactive, or not-offered value blocks payment. |
| `allowedCurrencies` | String | — | Comma-separated ISO codes the payer may choose (e.g. `EUR,USD`). Empty auto-detects the org's active currencies. The picker is shown only when more than one currency is available. |
| `amount` | String | `10.50` | Amount the payer is charged, preset and displayed as read-only. Dot-decimal form (e.g. `10.50`), never a locale format like `10,50`; must be greater than zero or payment is blocked. |
| `defaultFrequency` | String | `oneTime` | Payment frequency, preset and displayed as read-only. Set to `One time` or `Monthly` (the `oneTime`/`recurring` codes are also accepted). |

Recurring payments are sent with `Recurring.Frequency: 'Monthly'` — the only frequency currently supported. Add a configurable frequency property if another frequency is needed.

`Recurring.StartDate` is required by the Payment API (`yyyy-mm-dd`) for every source, so the form always sends it, defaulting to **today** (payer's local time). It is the *earliest* collection date — the API normalises the exact day to the org's payment schedule (e.g. day-of-month), so the day sent here need not be exact.

### `c-payment-selector` — API

Use `c-payment-selector` directly when you want only the payment method selector in a custom LWC form, without the full `c-payment-form` wrapper.

| Property / Event | Type | Description |
| --- | --- | --- |
| `config` | Array or JSON string | The flat payment method config array (see [Payment Method Configuration](#payment-method-configuration)). |
| `frequency` | String | `'onetime'` or `'recurring'` (case-insensitive). Filters the displayed methods by `enabledOneTime` / `enabledRecurring`. Default: `'onetime'`. |
| `paymentIntentResponse` | Object | Optional. Pass the response from `cpm-pay-button` back to the selector for post-payment state. |
| `onpaymentmethodchanged` | Event | Fired when the payer selects a method. `event.detail` contains the enriched entry (`name`, `processor`, `target`, `parameters`) — ready to use as `PaymentMethod` in a PaymentIntent. Bubbles and is composed. |

Example — embedding the standalone selector in a custom LWC:

```html
<c-payment-selector
    config={paymentMethodConfig}
    frequency={frequency}
    onpaymentmethodchanged={handlePaymentMethodChanged}>
</c-payment-selector>
```

## Installation

1. Install the package using the link above.
2. If the site needs to accept payments from unauthenticated (guest) users, complete the **Experience Cloud & Guest User Setup** steps in [experience-cloud-templates](https://github.com/FinDockLabs/experience-cloud-templates) first — payments will fail at runtime otherwise, even though the page renders correctly. For guest users, also assign the **FinDockLabs Payment Guest Access** permission set.
3. Run `npm run generate:config -- --org <alias>` to generate `paymentMethodConfiguration.js` from your org's active payment methods, then fill in the `target` field for each entry. See [Payment Method Configuration](#payment-method-configuration) below for details.
4. Update `SuccessURL` and `FailureURL` in `paymentForm.js` (`_updatePaymentIntentContext`) to point to pages within your Experience Cloud site. These are currently hardcoded (`https://example.com/...`); they will be exposed as `c-payment-form` design properties in a later release so they can be configured in Experience Builder without editing code.
5. Set the amount, currency, and frequency by editing the `@api` defaults in `paymentForm.js` (see [Configuration Properties](#c-payment-form--configuration-properties)) — they are not exposed in Experience Builder. Then add `c-payment-form` to your Experience Cloud page.

## Payment Method Configuration

Which methods appear, and how they're configured, is defined statically in `paymentMethodConfiguration.js` — edit this file to match the payment methods and processors active in your org.

### Generating the config from your org

Use the included script to generate a ready-to-edit `paymentMethodConfiguration.js` from your org's active payment methods.

**Prerequisites:** [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) installed and authenticated to the target org.

```bash
npm run generate:config -- --org <orgAlias>
```

Example:

```bash
npm run generate:config -- --org Dev_org
```

The script calls `GET /PaymentMethods` via anonymous Apex, formats the response into the flat config array, and overwrites `paymentMethodConfiguration.js` directly. Entries are sorted by `paymentProcessor` first, then `paymentMethod`, so methods for the same processor stay grouped together. After it runs:

1. **Fill in the `target` field** for each entry — it's left empty by the script. Find the value in FinDock Setup → Processors & Methods → Accounts tab. The merchant account is not returned by the API, so this step is always manual.
2. **Review `enabledOneTime` / `enabledRecurring`** — the script enables one-time for all methods and recurring only where `supportsRecurring` is `true`. Adjust if needed.
3. **Set `isDefaultOneTime` / `isDefaultRecurring`** — the script pre-selects the first entry in the sorted list. Change if a different method should be the default.

**Alternative — Developer Console:** paste `scripts/apex/generate-payment-method-config.apex` into Execute Anonymous, run it, then find the `FDPAYCONFIG:` line in the debug log and copy the JSON from there.

### Config field reference

| Field | Description |
| --- | --- |
| `paymentProcessor` | Name of the FinDock processor package (e.g. `PaymentHub-Stripe`). Maps to `PaymentMethod.Processor`. Source: `PaymentMethods[].Processors[].Name`. |
| `paymentMethod` | Name of the payment method. Maps to `PaymentMethod.Name` in the PaymentIntent. Source: `PaymentMethods[].Name` from `GET /PaymentMethods`. |
| `target` | Merchant account name. Maps to `PaymentMethod.Target`. Find it in FinDock Setup → Processors & Methods → Accounts tab. Not returned by the API — must be filled in manually. Optional: leave empty to use the processor's default account, but the processor must have at least one account configured. |
| `enabledOneTime` | Show this method for one-time payments. |
| `enabledRecurring` | Show this method for recurring payments. Enabling this for a method whose processor doesn't actually support recurring has no effect — see the guard note below. |
| `isDefaultOneTime` | Pre-select this method for one-time payments. Exactly one entry should be `true`. |
| `isDefaultRecurring` | Pre-select this method for recurring payments. Exactly one entry where `enabledRecurring` is `true` should be `true`. |
| `displayLabel` | Label shown to the payer. A plain string, or a Custom Label reference (`labels.<name>`) so the name follows the site language. Defaults to `paymentMethod` (the API method name) when omitted — the smart default. See [Localization](#localization). |
| `redirectInstruction` | Message shown before PSP redirect (e.g. for iDEAL, Bancontact). Payer-facing — use a Custom Label reference (`labels.<name>`) to keep it translatable. Omit when there is no redirect. |
| `parameters` | Array of additional processor parameters (e.g. `locale`, `description`). `null` or omit when none. Each entry: `name`, `value`, `visibleToCustomer`, `displayLabel`, `required`, `description`. |

### Recurring with an initial payment

Some methods take a first payment up front when a recurring payment is set up. `paymentForm` adds an initial `OneTime` block **only when the method's `recurringRequiresInitialPayment` is `true`** (the first payment is then charged immediately); other methods set up the mandate only. This flag is sourced live from the org, so it always matches the processor's actual behavior.

See [Initial payments for recurring payments](https://docs.findock.com/api/initial-payments-for-recurring-payments) for the full behavior and per-processor support.

### Validation and empty states

- **Misconfigured payment methods** — the form checks `paymentMethodConfiguration.js` on load. If it isn't an array, is empty, or an entry is missing `paymentProcessor` / `paymentMethod`, the form renders nothing and logs the specific problem(s) to the browser console. For a valid config, the managed selector surfaces its own message if methods still can't be shown, and the Pay Button stays disabled until a method is selected — so a broken config can never be submitted.
- **Misconfigured amount or currency** — the Pay Button stays disabled (payment blocked) when `amount` is not a positive number, or when `defaultCurrency` is invalid, inactive in the org, or not among the `allowedCurrencies`. The reason is logged to the browser console for the admin; the form itself still renders.
- **Runtime failures** — a well-formed config that references a method/processor/target not active in the org isn't caught up front; the PaymentIntent fails at runtime and the message is surfaced via the payment error channel. Regenerate the config (`npm run generate:config`) when the org's methods change.

### Flat parameter fields

| Field | Meaning |
| --- | --- |
| `name` | Parameter key (maps to `PaymentMethod.Parameters[name]`). Source: `Parameters[].Name` from `GET /PaymentMethods` |
| `value` | Value sent to the processor. Leave empty for payer-filled fields |
| `visibleToCustomer` | `true` → render as an input for the payer; `false` → send silently (default) |
| `displayLabel` | Label shown to the payer when `visibleToCustomer` is `true`. A plain string, or a Custom Label reference (`labels.<name>`) for translation. Defaults to `name` |
| `required` | Indicates if the processor requires this parameter |
| `description` | Explanation of the parameter (for internal use and guidance) |

## Localization

The components are built to run on a multilingual Experience Cloud (LWR) site — one site with several languages enabled, not a page per language. Guests pick a language with the standard [Language Selector](https://help.salesforce.com/s/articleView?id=sf.rss_language_picker.htm) (the page reloads translated); authenticated users get their profile language. Don't build a language switcher into the form — rely on the standard component.

**Component text comes from Custom Labels.** The strings our components render come from Custom Labels categorized as `FinDock, Experience Cloud` (and `FinDock, Accessibility` for assistive-text labels) — see `force-app/main/default/labels/CustomLabels.labels-meta.xml` and the `paymentFormLabels.js` registry. The payer-facing strings you set in `paymentMethodConfiguration.js` (`displayLabel`, `redirectInstruction`) can be a **plain string** or a **Custom Label reference** (`labels.<name>`) — use a label when you want the text to follow the site language:

```js
import {labels} from './paymentFormLabels';
// ...
// Plain string — simplest, not localized:
displayLabel: 'Credit Card',
// Custom Label reference — follows the site language:
displayLabel: labels.ec_your_label,
```

To use a label, add it to `CustomLabels.labels-meta.xml` and the `paymentFormLabels.js` registry, then reference it as `labels.<name>`. Omit a method's `displayLabel` to fall back to the API method name (the **smart default**); visible parameter `displayLabel`s fall back to the parameter `name`.

**Translating / overriding the text** (done in your own org, per language):

- **Packaged labels** — in Setup → Custom Labels, open a label and add a *Local Translations/Overrides* entry per language. This also overrides the English source. Overrides are not updated when we change the English source in a release, so keep a translation-management process.
- **Bulk translation** — `translations/CustomLabels_template.xlf` is a ready-made XLIFF template listing the components' labels, each with an empty `<target>`. For each language, copy it, replace `TARGET_LANGUAGE_CODE` with your Salesforce locale code (e.g. `fr`, `de`), fill in the `<target>` values, and import it via Setup → Translation Workbench → Import. If an import is rejected, copy the `<file ...>` header from a real export of your org (Setup → Translation Workbench → Export) and use that.
- **Your Flow screens** and **picklist values** — Setup → Translation Workbench → Translate (Setup Component = *Flow*). Note: STF file import rejects Flow components, so flows must be translated through the Translate UI.
- **Experience Builder content** (titles, rich text) — per-language values in the component property editor, or site export/import.

Translation Workbench must be enabled and languages added before installing, and LWR requires a **site republish** after language configuration changes. Untranslated elements fall back to the default (English) label.

**Numbers and dates.** The amount is formatted with `Intl.NumberFormat` against `@salesforce/i18n/locale` (the active locale), so grouping/decimal separators follow the payer's language. `Recurring.StartDate` is sent to the API as an ISO date (`yyyy-mm-dd`) and is not displayed, so it needs no locale formatting. On LWR the timezone follows the browser.

## How it works

`c-payment-form` assembles the PaymentIntent reactively from the configured amount and frequency plus form state (personal info, selected payment method) and passes the whole object to `cpm-pay-button` via the `payment-intent` property. The managed Pay Button component calls `cpm.API_PaymentIntent_V2.postPaymentIntent()` in-transaction and handles the PSP redirect — no custom Apex controller is needed.

The Pay Button is disabled until all required fields are filled and a payment method is selected.

`c-payment-selector` wraps the managed `cpm-payment-method-selector` component. It accepts the simplified flat config from `paymentMethodConfiguration.js`, enriches it into the format the managed component expects (mapping `paymentMethod` → `name`, `paymentProcessor` → `processor`, generating the `key`), and re-fires the `paymentmethodchanged` event with `bubbles: true, composed: true` so it propagates through shadow DOM.

To add pre- or post-payment Apex logic, or to change the PaymentIntent shape beyond what the component supports, fork `paymentForm` or build a custom LWC that embeds `c-payment-selector` and `cpm-pay-button` directly.

## Handling payment errors

When a payment fails, the managed `cpm-pay-button` broadcasts a `PAYMENT_ERROR` message on the `findockPaymentFlow` Lightning Message Channel. The classification is done server-side; the browser only receives the resolved values.

**Message body**

| Field | Meaning |
| --- | --- |
| `statusCode` | HTTP status of the PaymentIntent call. `200` on success, `422` when the request was well-formed but rejected (e.g. invalid data), other `4xx`/`5xx` on failure. |
| `errorCode` | FinDock error code, e.g. `202` (invalid IBAN). Used to route the error to a specific payment-method input. Null when the failure has no code. |
| `errorMessage` | Raw provider message (technical, locale-dependent). Prefer `errorLabel` for what you show the payer. |
| `errorLabel` | Payer-facing summary message, categorised server-side from the code (recoverable bank-detail issue, configuration problem, invalid data, or generic). |

See the full **Error and response codes** list in the [Payment API reference](https://docs.findock.com/api).

**What the components do out of the box**

- **Field-level errors** (bank-detail codes `201`–`206`) are highlighted inline on the matching input by the managed `cpm-payment-method-selector` — no code needed.
- **Everything else** is shown by `cpm-pay-button` as its own inline message above the button. `c-payment-form` does **not** render a second banner, so the message isn't duplicated.

**Extending / customizing**

`c-payment-form` subscribes to the `findockPaymentFlow` channel and re-surfaces the Pay Button's errors as an extension point, so you don't have to re-wire the channel:

- it re-dispatches a **`paymenterror`** DOM event (`event.detail` is the error — `statusCode`, `errorCode`, `errorMessage`, `errorLabel`) and a **`paymentpending`** event when a new attempt starts;
- it keeps the last error in the `paymentError` property.

Wrap the component and listen to the event to add your own handling (redirect to a failure page, logging, a custom banner, analytics):

```html
<c-payment-form onpaymenterror={handlePaymentError}></c-payment-form>
```

```js
handlePaymentError(event) {
    const { statusCode, errorCode, errorLabel } = event.detail;
    // e.g. show errorLabel, or redirect to your failure URL for non-recoverable errors
}
```

If you fork the component, bind to `paymentError` in the template to render your own banner. You can also read the `PaymentIntentResponseContext` returned by `cpm-pay-button` directly (same `statusCode` / `errorCode` / `errorMessage` / `errorLabel` fields).
