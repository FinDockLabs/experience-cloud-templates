import { createElement } from 'lwc';
import CurrencyPicker from 'c/currencyPicker';
import getActiveCurrencies from '@salesforce/apex/CurrencyPickerController.getActiveCurrencies';

jest.mock(
    '@salesforce/apex/CurrencyPickerController.getActiveCurrencies',
    () => ({ default: jest.fn(() => Promise.resolve(['EUR', 'USD', 'GBP'])) }),
    { virtual: true }
);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
});

// Creates the element, wires a currencychange listener, then appends it so we can capture the
// event dispatched during connectedCallback.
function mount(props = {}) {
    const element = createElement('c-currency-picker', { is: CurrencyPicker });
    Object.assign(element, props);
    const changes = [];
    element.addEventListener('currencychange', (e) => changes.push(e.detail.currency));
    document.body.appendChild(element);
    return { element, changes };
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    try { sessionStorage.clear(); } catch { /* unavailable */ }
});

describe('c-currency-picker', () => {
    it('renders a combobox with one option per active allowed currency', async () => {
        const { element } = mount({ allowedCurrencies: 'EUR,USD,GBP', defaultCurrency: 'EUR' });
        await flush();
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox).not.toBeNull();
        expect(combobox.options.map((o) => o.value)).toEqual(['EUR', 'USD', 'GBP']);
    });

    it('normalizes and de-duplicates the allow-list (case, spaces, repeats)', async () => {
        const { element } = mount({ allowedCurrencies: ' eur , usd ,EUR', defaultCurrency: 'eur' });
        await flush();
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox.options.map((o) => o.value)).toEqual(['EUR', 'USD']);
    });

    it('collapses and emits the value when only one active currency is allowed', async () => {
        const { element, changes } = mount({ allowedCurrencies: 'EUR' });
        await flush();
        expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
        expect(element.value).toBe('EUR');
        expect(changes).toEqual(['EUR']);
    });

    it('uses a configured default when it is active', async () => {
        const { element } = mount({ defaultCurrency: 'GBP' });
        await flush();
        expect(element.value).toBe('GBP');
    });

    it('auto-detects the org currencies via Apex when no allow-list is set', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const { element } = mount({}); // no allow-list → triggers auto-detect
        await flush();
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox).not.toBeNull();
        expect(combobox.options.map((o) => o.value)).toEqual(['EUR', 'USD', 'GBP']);
        expect(element.value).toBe('EUR'); // first allowed (no fixed default given)
    });

    it('fails closed when active currencies cannot be loaded', async () => {
        getActiveCurrencies.mockRejectedValueOnce(new Error('Unavailable'));
        const { element, changes } = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'EUR' });
        await flush();
        expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
        expect(element.value).toBe('');
        expect(element.validate().isValid).toBe(false);
        expect(changes).toEqual(['']);
    });

    it('uses the active org currency when Apex returns exactly one currency', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR']);
        const { element, changes } = mount({});
        await flush();
        expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
        expect(element.value).toBe('EUR');
        expect(changes).toEqual(['EUR']);
    });

    it('removes configured currencies that are no longer active', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR']);
        const { element, changes } = mount({
            allowedCurrencies: 'EUR,USD,GBP',
            defaultCurrency: 'USD'
        });
        await flush();
        expect(getActiveCurrencies).toHaveBeenCalledTimes(1);
        expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
        expect(element.value).toBe('EUR');
        expect(changes).toEqual(['EUR']);
    });

    it('fails closed when no configured currency remains active', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['JPY']);
        const { element } = mount({
            allowedCurrencies: 'EUR,USD',
            defaultCurrency: 'EUR'
        });
        await flush();
        expect(element.value).toBe('');
        expect(element.validate().isValid).toBe(false);
    });

    it('does not treat an invalid non-empty allow-list as no restriction', async () => {
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { element } = mount({ allowedCurrencies: 'euro,$' });
        await flush();
        expect(element.value).toBe('');
        expect(element.validate().isValid).toBe(false);
        expect(consoleWarn).toHaveBeenCalledTimes(2);
        consoleWarn.mockRestore();
    });

    describe('default currency', () => {
        it('uses the configured default when it is active and allowed', async () => {
            const { element } = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'USD' });
            await flush();
            expect(element.value).toBe('USD');
        });

        it('falls back to the first active allowed currency when the default is not allowed', async () => {
            const { element } = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'JPY' });
            await flush();
            expect(element.value).toBe('EUR');
        });

        it('ignores an externally assigned currency outside the active allow-list', async () => {
            const { element } = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'EUR' });
            await flush();
            element.value = 'JPY';
            expect(element.value).toBe('EUR');
        });
    });

    it('emits currencychange exactly once during auto-detect (no intermediate fallback emit)', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const { element, changes } = mount({}); // no allow-list → triggers auto-detect
        expect(changes).toEqual([]); // fallback is applied silently, before Apex resolves
        await flush();
        expect(changes).toEqual(['EUR']); // single emit with the auto-detected value
        expect(element.value).toBe('EUR');
    });

    it('emits once even when Apex returns no active currencies', async () => {
        getActiveCurrencies.mockResolvedValueOnce([]);
        const { element, changes } = mount({ defaultCurrency: 'GBP' });
        expect(changes).toEqual([]);
        await flush();
        expect(changes).toEqual(['']);
        expect(element.validate().isValid).toBe(false);
    });

    it('keeps an externally set value when a late auto-detect list still contains it', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const { element } = mount({ value: 'GBP' }); // parent/Flow sets value before Apex resolves
        await flush();
        expect(element.value).toBe('GBP'); // not overridden by codes[0]
    });

    it('emits currencychange when the payer switches currency', async () => {
        const { element, changes } = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'EUR' });
        await flush();
        expect(changes).toEqual(['EUR']); // initial
        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        combobox.dispatchEvent(new CustomEvent('change', { detail: { value: 'USD' } }));
        expect(element.value).toBe('USD');
        expect(changes).toEqual(['EUR', 'USD']);
    });

    it('reports a valid Flow screen value when a currency is selected', async () => {
        const { element } = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'EUR' });
        await flush();
        expect(element.validate()).toEqual({ isValid: true, errorMessage: null });
    });

    it('restores the picked currency on re-mount instead of resetting to the default', async () => {
        // Payer picks USD over the EUR default...
        const first = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'EUR' });
        await flush();
        first.element.shadowRoot
            .querySelector('lightning-combobox')
            .dispatchEvent(new CustomEvent('change', { detail: { value: 'USD' } }));
        expect(first.element.value).toBe('USD');

        // ...navigates back, so Flow tears the component down and re-creates it.
        document.body.removeChild(first.element);
        const second = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'EUR' });
        await flush();

        expect(second.element.value).toBe('USD'); // restored, not reset to EUR
    });

    it('ignores a stored currency that is no longer selectable', async () => {
        try {
            sessionStorage.setItem(`cp-state-${window.location.pathname}`, JSON.stringify({ selected: 'JPY' }));
        } catch { /* unavailable */ }
        const { element } = mount({ allowedCurrencies: 'EUR,USD', defaultCurrency: 'EUR' });
        await flush();
        expect(element.value).toBe('EUR'); // stored JPY not in the allow-list → falls back to default
    });
});
