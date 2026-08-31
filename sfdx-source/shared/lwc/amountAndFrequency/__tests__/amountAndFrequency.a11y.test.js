import { createElement } from 'lwc';
import AmountAndFrequency from 'c/amountAndFrequency';

// toBeAccessible() is registered globally by jest.setup.a11y.js via @sa11y/jest setup().
// It runs axe-core with Salesforce preset rules covering WCAG 2.1 AA + WCAG 2.2 AA
// success criteria that can be verified automatically.

function createComponent(props = {}) {
    const element = createElement('c-amount-and-frequency', { is: AmountAndFrequency });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-amount-and-frequency WCAG 2.2 AA accessibility', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        sessionStorage.clear();
    });

    // ── 1. Base state ───────────────────────────────────────────────────────────
    // Covers: 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value
    // The custom-amount <input type="number"> must have a programmatically
    // associated <label> (via for/id pair) and no duplicate IDs on the page.
    it('passes axe scan with only the custom-amount input visible', async () => {
        const element = createComponent({ currencyCode: 'USD' });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 2. Frequency toggle ─────────────────────────────────────────────────────
    // Covers: 1.3.1, 4.1.2
    // Radio inputs inside a <fieldset> must each have a <label for="…"> that
    // matches their id, and the group must have a <legend>.
    it('passes axe scan when the frequency toggle is shown', async () => {
        const element = createComponent({
            currencyCode: 'USD',
            showFrequencyToggle: true,
        });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 3. Preset amounts ───────────────────────────────────────────────────────
    // Covers: 1.3.1, 4.1.2
    // Each preset radio must have a unique id, a paired <label for="…">, and
    // sit inside a <fieldset> with a <legend>; no duplicate IDs may exist.
    it('passes axe scan when preset amount buttons are rendered', async () => {
        const element = createComponent({
            currencyCode: 'USD',
            presetAmountsOneTime: '25,50,100',
        });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 4. Frequency toggle + presets together ──────────────────────────────────
    // Verifies the two <fieldset> groups coexist without ID collisions and that
    // both legends are still present (1.3.1) when the full UI is visible.
    it('passes axe scan with frequency toggle and preset amounts together', async () => {
        const element = createComponent({
            currencyCode: 'USD',
            showFrequencyToggle: true,
            presetAmountsOneTime: '25,50,100,250',
            presetAmountsRecurring: '5,10,25,60',
        });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 5. Validation error state ───────────────────────────────────────────────
    // Covers: 3.3.1 Error Identification, 3.3.3 Error Suggestion (WCAG 2.2 AA)
    // When a validation error is present the component renders:
    //   • aria-invalid="true" on the input (4.1.2)
    //   • aria-describedby pointing to the error paragraph id (1.3.1)
    //   • role="alert" on the error paragraph so SR users are notified (4.1.3)
    it('passes axe scan when a validation error is displayed', async () => {
        const element = createComponent({
            currencyCode: 'USD',
            minAmount: 10,
        });
        await Promise.resolve();

        // Simulate typing an amount below the minimum to trigger the error.
        const input = element.shadowRoot.querySelector('input.custom-amount-input-native');
        input.value = '1';
        input.dispatchEvent(new Event('input'));
        await Promise.resolve();

        // Confirm the error paragraph is actually rendered before we axe-scan.
        const errorEl = element.shadowRoot.querySelector('[role="alert"]');
        expect(errorEl).not.toBeNull();

        await expect(element).toBeAccessible();
    });

    it('passes axe scan with required and external Flow errors displayed together', async () => {
        const element = createComponent({ currencyCode: 'USD' });
        await Promise.resolve();

        element.setCustomValidity('<strong>Flow validation failed</strong>');
        element.reportValidity();
        await Promise.resolve();

        expect(element.shadowRoot.querySelectorAll('[role="alert"]')).toHaveLength(2);
        await expect(element).toBeAccessible();
    });

    // ── 6. ARIA decorative icon ─────────────────────────────────────────────────
    // Covers: 1.1.1 Non-text Content
    // The lightning-icon inside the monthly label carries aria-hidden="true",
    // removing it from the accessibility tree; axe must not flag it as missing
    // alternative text.
    it('passes axe scan: monthly icon is hidden from assistive technology', async () => {
        const element = createComponent({
            currencyCode: 'USD',
            showFrequencyToggle: true,
        });
        await Promise.resolve();

        const icon = element.shadowRoot.querySelector('lightning-icon[aria-hidden="true"]');
        expect(icon).not.toBeNull();

        await expect(element).toBeAccessible();
    });

    // ── 7. Multiple instances on the same page (unique IDs) ─────────────────────
    // Covers: 4.1.1 Parsing
    // The component uses a per-instance counter to generate unique DOM IDs.
    // Two instances on the same page must not produce duplicate id values,
    // which axe flags as a critical violation.
    it('passes axe scan with two component instances on the same page', async () => {
        createComponent({ currencyCode: 'USD', showFrequencyToggle: true });
        createComponent({ currencyCode: 'EUR', showFrequencyToggle: true });
        await Promise.resolve();
        await expect(document.body).toBeAccessible();
    });
});
