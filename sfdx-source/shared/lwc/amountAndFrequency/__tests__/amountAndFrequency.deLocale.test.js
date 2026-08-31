import { createElement } from 'lwc';
import AmountAndFrequency from 'c/amountAndFrequency';

// Force a comma-decimal locale (group ".", decimal ",") to reproduce the 100x amount corruption:
// enter 25,50 → blur → focus → type one digit. See amountAndFrequency handleCustomAmountFocus.
jest.mock('@salesforce/i18n/locale', () => ({ default: 'de-DE' }), { virtual: true });

function input(element) {
    return element.shadowRoot.querySelector('.custom-amount-input-native');
}

function type(el, raw) {
    el.value = raw;
    el.dispatchEvent(new CustomEvent('input', { bubbles: true, composed: true }));
}

function fire(el, name) {
    el.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
}

describe('comma-decimal locale (de-DE) amount is not corrupted across focus/blur', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        sessionStorage.clear();
    });

    async function mount() {
        const element = createElement('c-amount-and-frequency', { is: AmountAndFrequency });
        element.currencyCode = 'EUR';
        document.body.appendChild(element);
        await Promise.resolve();
        return element;
    }

    it('focus writes back the locale-formatted value (comma), symmetric with blur', async () => {
        const element = await mount();
        const el = input(element);

        type(el, '25,50');
        await Promise.resolve();
        // Emitted verbatim (string-based, no Number round-trip) — the trailing zero is preserved.
        expect(element.amountOneTime).toBe('25.50');

        fire(el, 'blur');
        expect(el.value).toBe('25,50'); // locale decimal comma

        fire(el, 'focus');
        // Must NOT be "25.50" with a dot: "." is grouping in de-DE and the next keystroke would reparse it.
        expect(el.value).toBe('25,50');
    });

    it('focus drops grouping separators, blur restores them', async () => {
        const element = await mount();
        const el = input(element);

        type(el, '1234567,89');
        await Promise.resolve();

        fire(el, 'blur');
        expect(el.value).toBe('1.234.567,89'); // grouped at rest

        fire(el, 'focus');
        expect(el.value).toBe('1234567,89'); // ungrouped while editing (stable caret)
    });

    it('typing another digit after focus keeps the amount, does not multiply it 100x', async () => {
        const element = await mount();
        const el = input(element);

        type(el, '25,5');
        await Promise.resolve();
        expect(element.amountOneTime).toBe('25.5');

        fire(el, 'blur');
        fire(el, 'focus');

        // User appends a digit to the focused value the handler wrote back.
        type(el, `${el.value}1`); // "25,51"
        await Promise.resolve();

        // Correct: 25.51 — not 2551.
        expect(element.amountOneTime).toBe('25.51');
    });

    it('formats a value beyond Number.MAX_SAFE_INTEGER without corrupting digits on focus', async () => {
        const element = await mount();
        const el = input(element);

        // Enter a huge amount in de-DE format ("." grouping, "," decimal). Number() would round this
        // to 12345678977355334000 and drop the fraction; formatting must be purely string-based.
        type(el, '12.345.678.977.355.334.000,77');
        await Promise.resolve();
        expect(element.amountOneTime).toBe('12345678977355334000.77');

        fire(el, 'blur');
        await Promise.resolve();
        // At rest, every digit must survive and the grouping is restored.
        expect(el.value).toBe('12.345.678.977.355.334.000,77');

        fire(el, 'focus');
        await Promise.resolve();
        // While editing, grouping is dropped but every digit still survives (no Number round-trip).
        expect(el.value).toBe('12345678977355334000,77');
    });

    it('keeps the grouping separators visible at rest (not only on focus)', async () => {
        const element = await mount();
        const el = input(element);

        type(el, '1234567,89');
        await Promise.resolve();
        fire(el, 'blur');
        await Promise.resolve();

        // Unfocused, the input must already show the locale-grouped form — separators should not
        // wait for a focus event to appear.
        expect(el.value).toBe('1.234.567,89');
    });

    it('re-formats the resting value when the currency changes (same precision)', async () => {
        const element = await mount(); // EUR, 2 decimals
        const el = input(element);

        type(el, '1234,5');
        await Promise.resolve();
        fire(el, 'blur');
        await Promise.resolve();
        expect(el.value).toBe('1.234,5');

        // Switch to another 2-decimal currency: the value is kept and the field must stay grouped,
        // re-rendering reactively — not collapse to an unformatted "1234.5" that only re-groups on
        // the next focus (the reported bug).
        element.currencyCode = 'USD';
        await Promise.resolve();
        expect(el.value).toBe('1.234,5');
    });

    it('keeps a whole-number amount grouped when moving to a zero-decimal currency', async () => {
        const element = await mount(); // EUR, 2 decimals
        const el = input(element);

        type(el, '1234'); // no fraction → survives the switch to JPY (0 decimals)
        await Promise.resolve();
        fire(el, 'blur');
        await Promise.resolve();
        expect(el.value).toBe('1.234');

        element.currencyCode = 'JPY';
        await Promise.resolve();
        expect(el.value).toBe('1.234');
    });
});
