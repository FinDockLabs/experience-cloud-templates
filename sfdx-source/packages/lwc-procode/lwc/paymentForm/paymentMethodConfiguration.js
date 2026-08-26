/**
 * Payment method configuration for the paymentForm component.
 *
 * Defines which payment methods are shown to the payer and how they behave.
 * Edit to match the payment methods and processors activated in your org.
 *
 * ---
 * HOW TO POPULATE THIS FILE
 *
 * Run the generation script from the repo root — it calls GET /PaymentMethods via
 * anonymous Apex and overwrites this file with the active methods from your org:
 *
 *   npm run generate:config -- --org <orgAlias>
 *
 * After running: fill in the `target` field for each entry (not returned by the API).
 * Find it in FinDock Setup → Processors & Methods → processor → Accounts tab.
 *
 * Alternative: paste scripts/apex/generate-payment-method-config.apex into
 * Developer Console → Execute Anonymous and copy from the FDPAYCONFIG: line in the log.
 *
 * ---
 * RESOLVED LIVE BY THE MANAGED SELECTOR (intentionally NOT in this file)
 *
 * The managed payment selector enriches each raw entry at runtime from the org
 * (GET /PaymentMethods), so you do not declare these here:
 *   - whether the processor supports recurring for a method,
 *   - whether a recurring setup requires an initial payment up front,
 *   - each parameter's data type.
 * The selector overlays these authoritative values when the form renders; you only
 * declare the fields documented below.
 *
 * ---
 * FIELD REFERENCE
 *
 * PAYMENT INTENT FIELDS  (sent to POST /PaymentIntent as PaymentMethod.*)
 *
 *   paymentProcessor
 *     FinDock processor package name. Maps to PaymentMethod.Processor. Required.
 *     Source: PaymentMethods[].Processors[].Name from GET /PaymentMethods.
 *     Example: "PaymentHub-Stripe"
 *
 *   paymentMethod
 *     Name of the payment method. Maps to PaymentMethod.Name. Required.
 *     Source: PaymentMethods[].Name from GET /PaymentMethods.
 *     Example: "CreditCard"
 *
 *   target
 *     Merchant account that receives the payment. Maps to PaymentMethod.Target.
 *     Optional — leave empty ('') to use the processor's Default Account (the
 *     processor must have one, or the payment fails at runtime). Set explicitly
 *     only to route to a non-default account. Not returned by the API for PSPs —
 *     find it in FinDock Setup → Processors & Methods → processor → Accounts tab.
 *     Example: "Stripe-Main-Account"
 *
 *   parameters
 *     Additional processor parameters. Maps to PaymentMethod.Parameters.
 *     Available parameters per processor/method: PaymentMethods[].Processors[].Parameters[].
 *
 * SELECTOR UI FIELDS  (control which methods appear and which is pre-selected)
 *
 *   enabledOneTime      Show this method for one-time payments.
 *   enabledRecurring    Show this method for recurring payments. Only takes effect for
 *                       methods whose processor actually supports recurring — the managed
 *                       selector resolves that live from the org and filters accordingly,
 *                       so a mistaken `true` here is ignored at runtime.
 *   isDefaultOneTime    Pre-select for one-time. Exactly one entry should be true.
 *   isDefaultRecurring  Pre-select for recurring. Exactly one enabledRecurring entry should be true.
 *   displayLabel        Label shown to the payer. A plain string, or a Custom Label
 *                       reference (labels.<name>) so the name follows the site language.
 *                       Omit to fall back to paymentMethod (the API method name) — the
 *                       smart default. See paymentFormLabels.js and the README's
 *                       Localization section.
 *   redirectInstruction Message shown before PSP redirect (e.g. iDEAL, Bancontact).
 *                       Payer-facing — use a Custom Label reference (labels.<name>) to
 *                       keep it translatable. Omit when there is no redirect.
 *
 * PARAMETER FIELDS  (each entry in the parameters array)
 *
 *   name              Parameter key. Source: Parameters[].Name from GET /PaymentMethods.
 *   value             Value sent to the processor. Leave empty for payer-filled fields.
 *   visibleToCustomer true — render as an input for the payer.
 *                     false — send silently (default).
 *   displayLabel      Label shown when visibleToCustomer is true. Defaults to name.
 *   required          Whether the processor requires this parameter.
 *   description       Human-readable explanation of the parameter.
 */
export const PAYMENT_METHOD_CONFIG = [
    {
        paymentProcessor: 'PaymentHub-Stripe',
        paymentMethod: 'CreditCard',
        target: 'Stripe-Main-Account',
        enabledOneTime: true,
        enabledRecurring: true,
        isDefaultOneTime: true,
        isDefaultRecurring: false,
        displayLabel: 'Credit Card',
        parameters: [
            {
                name: 'locale',
                value: 'nl-NL',
                visibleToCustomer: false,
                description: 'Expected input: language tags as outlined on https://www.oracle.com/java/technologies/javase/jdk13locales.html. Examples: nl-NL, en-US.'
            },
            {
                name: 'description',
                value: '',
                visibleToCustomer: true,
                displayLabel: 'Description',
                required: false,
                description: "Description of the payment for the payer's bank."
            }
        ]
    },
    {
        paymentProcessor: 'PaymentHub-Stripe',
        paymentMethod: 'Ideal',
        target: 'Stripe-Main-Account',
        enabledOneTime: true,
        enabledRecurring: false,
        isDefaultOneTime: false,
        isDefaultRecurring: false,
        displayLabel: 'iDEAL | Wero',
        redirectInstruction: 'You will be redirected to your bank to complete the payment.'
    }
];
