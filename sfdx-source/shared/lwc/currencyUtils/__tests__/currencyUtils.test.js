import {
    currencyDecimals,
    currencySymbolInfo,
    sanitizeAmountInput
} from 'c/currencyUtils';

describe('currencyDecimals', () => {
    it('returns 2 for standard minor-unit currencies', () => {
        expect(currencyDecimals('EUR', 'en-US')).toBe(2);
        expect(currencyDecimals('USD', 'en-US')).toBe(2);
    });

    it('returns 0 for zero-decimal currencies', () => {
        expect(currencyDecimals('JPY', 'en-US')).toBe(0);
    });

    it('falls back to 2 for a missing or invalid code', () => {
        expect(currencyDecimals('', 'en-US')).toBe(2);
        expect(currencyDecimals(null, 'en-US')).toBe(2);
        expect(currencyDecimals('NOTACODE', 'en-US')).toBe(2);
    });
});

describe('currencySymbolInfo', () => {
    it('returns the narrow symbol and prefix position for a leading-symbol currency', () => {
        const info = currencySymbolInfo('USD', 'en-US');
        expect(info.symbol).toBe('$');
        expect(info.position).toBe('prefix');
    });

    it('detects a trailing-symbol currency as a suffix', () => {
        const info = currencySymbolInfo('SEK', 'sv-SE');
        expect(info.position).toBe('suffix');
    });

    it('returns an empty prefix symbol when no code is given', () => {
        expect(currencySymbolInfo('', 'en-US')).toEqual({ symbol: '', position: 'prefix' });
    });

    it('falls back to the code as a prefix when the code is unrecognized', () => {
        expect(currencySymbolInfo('NOTACODE', 'en-US')).toEqual({ symbol: 'NOTACODE', position: 'prefix' });
    });
});

describe('sanitizeAmountInput', () => {
    it('normalizes a comma decimal separator to a dot', () => {
        expect(sanitizeAmountInput('25,50', 2)).toBe('25.50');
    });

    it('strips non-numeric characters', () => {
        expect(sanitizeAmountInput('$1a2b3', 2)).toBe('123');
    });

    it('collapses extra decimal separators', () => {
        expect(sanitizeAmountInput('1.2.3', 2)).toBe('1.23');
    });

    it('trims the fraction to the currency precision', () => {
        expect(sanitizeAmountInput('10.999', 2)).toBe('10.99');
    });

    it('drops the decimal point entirely for a zero-decimal currency', () => {
        expect(sanitizeAmountInput('10.5', 0)).toBe('10');
    });

    it('handles empty and nullish input', () => {
        expect(sanitizeAmountInput('', 2)).toBe('');
        expect(sanitizeAmountInput(null, 2)).toBe('');
        expect(sanitizeAmountInput(undefined, 2)).toBe('');
    });
});
