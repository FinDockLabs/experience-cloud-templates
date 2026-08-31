import { createElement } from 'lwc';
import currencyPickerConfig from 'c/currencyPickerConfig';
import getActiveCurrencies from '@salesforce/apex/CurrencyPickerController.getActiveCurrencies';

// The Apex stub is a jest mock so each test can supply the org's active currencies.
jest.mock(
    '@salesforce/apex/CurrencyPickerController.getActiveCurrencies',
    () => ({ default: jest.fn(() => Promise.resolve([])) }),
    { virtual: true }
);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(inputVariables = []) {
    const element = createElement('c-currency-picker-cpe', { is: currencyPickerConfig });
    element.inputVariables = inputVariables;
    document.body.appendChild(element);
    return element;
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
});

describe('c-currency-picker-cpe', () => {
    it('populates the multi-select options from the org active currencies (Apex)', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const element = mount([]);
        await flush();
        const dual = element.shadowRoot.querySelector('lightning-dual-listbox');
        expect(dual.options.map((o) => o.value)).toEqual(['EUR', 'USD', 'GBP']);
    });

    it('hides the allow-list and shows a notice in a single-currency org', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR']);
        const element = mount([]);
        await flush();
        expect(element.shadowRoot.querySelector('lightning-dual-listbox')).toBeNull();
        expect(element.shadowRoot.textContent).toContain('single active currency');
    });

    it('pre-selects the sole currency as the default in a single-currency org', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR']);
        const element = mount([]);
        const changed = [];
        element.addEventListener('configuration_editor_input_value_changed', (e) => changed.push(e.detail));
        await flush();
        expect(changed).toContainEqual({ name: 'defaultCurrency', newValue: 'EUR', newValueDataType: 'String' });
    });

    it('hides the default-currency selector in a single-currency org', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR']);
        const element = mount([]);
        await flush();
        // No selector to configure: the sole currency is applied automatically.
        expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
    });

    it('does not require a default currency in a single-currency org', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR']);
        const element = mount([]);
        await flush();
        expect(element.validate()).toEqual([]);
    });

    it('pre-fills the multi-select from active allowedCurrencies input values', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const element = mount([{ name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' }]);
        await flush();
        const dual = element.shadowRoot.querySelector('lightning-dual-listbox');
        expect(dual.value).toEqual(['EUR', 'USD']);
    });

    it('limits the default single-select to the selected available currencies', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const element = mount([{ name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' }]);
        await flush();
        const combo = element.shadowRoot.querySelector('lightning-combobox[data-name="defaultCurrency"]')
            || element.shadowRoot.querySelectorAll('lightning-combobox')[0];
        // The default single-select also offers a leading "Use Flow Variable..." entry; the
        // currency choices themselves are limited to the selected available currencies.
        const currencyValues = combo.options.map((o) => o.value).filter((v) => v !== 'USE_FLOW_VARIABLE');
        expect(currencyValues).toEqual(['EUR', 'USD']);
    });

    it('writes the available currencies back as CSV', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const element = mount([]);
        await flush();
        const changed = [];
        element.addEventListener('configuration_editor_input_value_changed', (e) => changed.push(e.detail));
        element.shadowRoot.querySelector('lightning-dual-listbox').dispatchEvent(
            new CustomEvent('change', { detail: { value: ['EUR', 'USD'] } })
        );
        expect(changed).toContainEqual({ name: 'allowedCurrencies', newValue: 'EUR,USD', newValueDataType: 'String' });
    });

    it('updates default options immediately when the allow-list changes', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const element = mount([]);
        await flush();
        element.shadowRoot.querySelector('lightning-dual-listbox').dispatchEvent(
            new CustomEvent('change', { detail: { value: ['EUR'] } })
        );
        await flush();
        const currencyValues = element.shadowRoot
            .querySelector('lightning-combobox')
            .options.map((option) => option.value)
            .filter((value) => value !== 'USE_FLOW_VARIABLE');
        expect(currencyValues).toEqual(['EUR']);
    });

    it('does not report a single-currency org when loading currencies fails', async () => {
        getActiveCurrencies.mockRejectedValueOnce(new Error('Unavailable'));
        const element = mount([]);
        await flush();
        expect(element.shadowRoot.querySelector('lightning-combobox')).not.toBeNull();
        expect(element.shadowRoot.textContent).not.toContain('single active currency');
    });

    it('clears the default when it is removed from the available currencies', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD']);
        const element = mount([
            { name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' },
            { name: 'defaultCurrency', value: 'USD', valueDataType: 'String' }
        ]);
        await flush();
        const changed = [];
        element.addEventListener('configuration_editor_input_value_changed', (e) => changed.push(e.detail));
        // Remove USD → only EUR remains; default USD is no longer valid.
        element.shadowRoot.querySelector('lightning-dual-listbox').dispatchEvent(
            new CustomEvent('change', { detail: { value: ['EUR'] } })
        );
        expect(changed).toContainEqual({ name: 'allowedCurrencies', newValue: 'EUR', newValueDataType: 'String' });
        expect(changed).toContainEqual({ name: 'defaultCurrency', newValue: '', newValueDataType: 'String' });
    });

    it('removes stale configured currencies when only one org currency remains active', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR']);
        const element = mount([
            { name: 'allowedCurrencies', value: 'EUR,USD,GBP', valueDataType: 'String' },
            { name: 'defaultCurrency', value: 'USD', valueDataType: 'String' }
        ]);
        const changed = [];
        element.addEventListener('configuration_editor_input_value_changed', (event) =>
            changed.push(event.detail)
        );

        await flush();

        expect(element.shadowRoot.querySelector('lightning-dual-listbox')).toBeNull();
        expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
        expect(element.shadowRoot.textContent).toContain('single active currency');
        expect(changed).toContainEqual({
            name: 'allowedCurrencies',
            newValue: '',
            newValueDataType: 'String'
        });
        expect(changed).toContainEqual({
            name: 'defaultCurrency',
            newValue: 'EUR',
            newValueDataType: 'String'
        });
    });

    it('removes inactive currencies from a partially active allow-list', async () => {
        getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD']);
        const element = mount([
            { name: 'allowedCurrencies', value: 'EUR,JPY', valueDataType: 'String' },
            { name: 'defaultCurrency', value: 'EUR', valueDataType: 'String' }
        ]);
        const changed = [];
        element.addEventListener('configuration_editor_input_value_changed', (event) =>
            changed.push(event.detail)
        );

        await flush();

        const dualListbox = element.shadowRoot.querySelector('lightning-dual-listbox');
        expect(dualListbox.options.map((option) => option.value)).toEqual(['EUR', 'USD']);
        expect(dualListbox.value).toEqual(['EUR']);
        expect(changed).toContainEqual({
            name: 'allowedCurrencies',
            newValue: 'EUR',
            newValueDataType: 'String'
        });
    });

    describe('validate()', () => {
        it('does not require an allow-list (blank = all active currencies)', () => {
            const element = mount([{ name: 'defaultCurrency', value: 'EUR', valueDataType: 'String' }]);
            // No allowedCurrencies set, but a default is → valid.
            expect(element.validate()).toEqual([]);
        });

        it('errors when no default currency source is chosen', () => {
            const element = mount([{ name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' }]);
            const errors = element.validate();
            expect(errors).toHaveLength(1);
            expect(errors[0].key).toBe('defaultCurrency');
        });

        it('errors when the Flow variable source is chosen but no variable is set', () => {
            const element = mount([{ name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' }]);
            // Choosing "Use Flow Variable..." without picking a variable leaves the value empty.
            element.shadowRoot.querySelectorAll('lightning-combobox')[0].dispatchEvent(
                new CustomEvent('change', { detail: { value: 'USE_FLOW_VARIABLE' } })
            );
            const errors = element.validate();
            expect(errors).toHaveLength(1);
            expect(errors[0].key).toBe('defaultCurrency');
        });

        it('passes with a fixed currency chosen', () => {
            const element = mount([
                { name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' },
                { name: 'defaultCurrency', value: 'EUR', valueDataType: 'String' }
            ]);
            expect(element.validate()).toEqual([]);
        });

        it('passes with a Flow variable chosen and set', () => {
            const element = mount([
                { name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' },
                { name: 'defaultCurrency', value: '{!currencyVar}', valueDataType: 'Reference' }
            ]);
            expect(element.validate()).toEqual([]);
        });

        it('rehydrates a saved Flow variable back into the Flow-variable source, whatever the type casing', () => {
            const element = mount([
                { name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' },
                { name: 'defaultCurrency', value: 'CHF_currency', valueDataType: 'reference' }
            ]);
            expect(element.shadowRoot.querySelector('lightning-combobox').value).toBe('USE_FLOW_VARIABLE');
            expect(element.shadowRoot.querySelector('cpm-flow-variable-input')).not.toBeNull();
        });

        it('errors when a literal String default is not a valid ISO code', () => {
            const element = mount([
                { name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' },
                { name: 'defaultCurrency', value: 'euro', valueDataType: 'String' }
            ]);

            // Invalid String literals remain fixed-value errors; they aren't reclassified as Flow variables.
            expect(element.shadowRoot.querySelector('cpm-flow-variable-input')).toBeNull();
            const errors = element.validate();
            expect(errors).toHaveLength(1);
            expect(errors[0].key).toBe('defaultCurrency');
            expect(errors[0].errorString).toMatch(/ISO 4217/);
        });

        it('rejects reference-like text when its declared type is String', () => {
            const element = mount([
                { name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' },
                { name: 'defaultCurrency', value: '{!currencyVar}', valueDataType: 'String' }
            ]);

            expect(element.shadowRoot.querySelector('cpm-flow-variable-input')).toBeNull();
            expect(element.validate()).toEqual([
                {
                    key: 'defaultCurrency',
                    errorString:
                        '"{!currencyVar}" is not a valid ISO 4217 currency code (for example, EUR or USD).'
                }
            ]);
        });

        it('does not ISO-check a real Flow-variable reference (resolved at runtime)', () => {
            // A Reference/Formula default can't be validated here; only literal Strings are checked.
            const element = mount([
                { name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' },
                { name: 'defaultCurrency', value: 'myCurrencyVar', valueDataType: 'Reference' }
            ]);
            expect(element.validate()).toEqual([]);
        });

        it('rejects a fixed default that is not active or offered', async () => {
            getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD']);
            const element = mount([
                { name: 'defaultCurrency', value: 'JPY', valueDataType: 'String' }
            ]);
            await flush();
            expect(element.validate()).toEqual([
                {
                    key: 'defaultCurrency',
                    errorString:
                        'Default currency "JPY" is not active or is not included in the offered currencies.'
                }
            ]);
        });

        it('rejects an allow-list when none of its currencies are active', async () => {
            getActiveCurrencies.mockResolvedValueOnce(['EUR', 'USD']);
            const element = mount([
                { name: 'allowedCurrencies', value: 'JPY,GBP', valueDataType: 'String' },
                { name: 'defaultCurrency', value: 'JPY', valueDataType: 'String' }
            ]);
            await flush();
            expect(element.validate()).toContainEqual({
                key: 'allowedCurrencies',
                errorString: 'These offered currencies are not active in your org: JPY, GBP.'
            });
        });

        it('mirrors the error message inline, then clears it once a default is picked', async () => {
            const element = mount([{ name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' }]);
            element.validate();
            await flush();
            const error = element.shadowRoot.querySelector('.field__error');
            expect(error).not.toBeNull();
            expect(error.textContent).toBe('Select a default currency source.');

            // Picking a currency resolves the error → the inline message disappears.
            element.shadowRoot.querySelectorAll('lightning-combobox')[0].dispatchEvent(
                new CustomEvent('change', { detail: { value: 'EUR' } })
            );
            await flush();
            expect(element.shadowRoot.querySelector('.field__error')).toBeNull();
        });
    });
});
