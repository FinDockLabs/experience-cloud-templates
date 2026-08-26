import { createElement } from 'lwc';
import CurrencyPickerConfig from 'c/currencyPickerConfig';
import getActiveCurrencies from '@salesforce/apex/CurrencyPickerController.getActiveCurrencies';

jest.mock(
    '@salesforce/apex/CurrencyPickerController.getActiveCurrencies',
    () => ({ default: jest.fn(() => Promise.resolve(['EUR', 'USD'])) }),
    { virtual: true }
);

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
});

describe('c-currency-picker-cpe WCAG 2.2 AA accessibility', () => {
    it('passes an axe scan in a multi-currency org', async () => {
        const element = createElement('c-currency-picker-cpe', { is: CurrencyPickerConfig });
        element.inputVariables = [
            { name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' },
            { name: 'defaultCurrency', value: 'EUR', valueDataType: 'String' }
        ];
        document.body.appendChild(element);
        await getActiveCurrencies();
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });
});
