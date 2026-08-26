import LOCALE from '@salesforce/i18n/locale';

// ISO 4217 currency code: three uppercase letters (e.g. EUR, USD, GBP).
export const ISO_CODE = /^[A-Z]{3}$/;

// Salesforce exposes the locale with underscores (e.g. "en_US"); Intl expects BCP 47 dashes.
export function currencyLocale() {
    return LOCALE ? LOCALE.replace(/_/g, '-') : 'en-US';
}

/**
 * Trim/upper-case a currency code and validate it as ISO 4217. Returns '' for anything invalid.
 * Pass logInvalid=true to log a diagnostic when a non-empty, non-ISO value is rejected (used by
 * the runtime picker to surface misconfigured allow-lists; the Flow Builder editor stays quiet).
 */
export function normalizeCurrency(code, logInvalid = false) {
    const raw = (code || '').toString().trim();
    if (!raw) {
        return '';
    }
    const upper = raw.toUpperCase();
    if (!ISO_CODE.test(upper)) {
        if (logInvalid) {
            // eslint-disable-next-line no-console
            console.warn(`Ignoring invalid ISO 4217 currency code: "${code}"`);
        }
        return '';
    }
    return upper;
}

// Remove duplicate entries, preserving first-seen order.
export function dedupe(list) {
    return [...new Set(list)];
}

/**
 * Number of fraction digits a currency uses (e.g. EUR/USD -> 2, JPY -> 0). Falls back to 2 when
 * the code is missing or unrecognized, matching the most common minor-unit convention.
 */
export function currencyDecimals(code, locale = 'en-US') {
    if (!code) {
        return 2;
    }
    try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: code })
            .resolvedOptions().maximumFractionDigits;
    } catch {
        return 2;
    }
}

/**
 * Narrow currency symbol and its position relative to the amount, e.g. EUR in en-US -> "€"/prefix,
 * SEK in sv-SE -> "kr"/suffix. Returns an empty prefix symbol when no code is given so callers can
 * render nothing rather than a placeholder currency.
 */
export function currencySymbolInfo(code, locale) {
    if (!code) {
        return { symbol: '', position: 'prefix' };
    }
    try {
        const parts = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: code,
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).formatToParts(0);
        const currencyIdx = parts.findIndex(p => p.type === 'currency');
        const integerIdx  = parts.findIndex(p => p.type === 'integer');
        const symbol      = parts[currencyIdx] ? parts[currencyIdx].value : code;
        const position    = currencyIdx < integerIdx ? 'prefix' : 'suffix';
        return { symbol, position };
    } catch {
        return { symbol: code, position: 'prefix' };
    }
}

/**
 * Clean a raw amount string for a currency with the given number of decimals: normalizes the
 * decimal separator to ".", strips non-numeric characters, collapses extra dots, and trims the
 * fraction to the currency's precision (0 decimals drops the dot entirely). Pure string in/out —
 * callers own reading from and writing back to the DOM.
 */
export function sanitizeAmountInput(rawValue, decimals) {
    let val = (rawValue || '').toString();
    val = val.replace(',', '.');
    val = val.replace(/[^0-9.]/g, '');
    const firstDot = val.indexOf('.');
    if (firstDot !== -1) {
        val = val.substring(0, firstDot + 1) + val.substring(firstDot + 1).replace(/\./g, '');
    }
    const dotIdx = val.indexOf('.');
    if (decimals === 0 && dotIdx !== -1) {
        val = val.substring(0, dotIdx);
    } else if (decimals > 0 && dotIdx !== -1 && val.length - dotIdx - 1 > decimals) {
        val = val.substring(0, dotIdx + decimals + 1);
    }
    return val;
}

/**
 * The character a locale uses as its decimal separator (e.g. "." in en-US, "," in de-DE/fr-FR/nl-NL).
 * Derived from Intl so it tracks the platform's ICU data rather than a hand-maintained table.
 */
export function decimalSeparator(locale) {
    try {
        const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
        const dec = parts.find(p => p.type === 'decimal');
        return dec ? dec.value : '.';
    } catch {
        return '.';
    }
}

/**
 * The character a locale uses as its grouping (thousands) separator (e.g. "," in en-US, "." in
 * de-DE, a non-breaking space in fr-FR). Returns '' when the locale groups with nothing detectable.
 */
export function groupSeparator(locale) {
    try {
        const parts = new Intl.NumberFormat(locale).formatToParts(1000000);
        const grp = parts.find(p => p.type === 'group');
        return grp ? grp.value : '';
    } catch {
        return '';
    }
}

/**
 * Format a plain dot-decimal amount string into locale display form, purely by string manipulation
 * so digits beyond Number.MAX_SAFE_INTEGER survive. With grouped=true the integer part gets the
 * locale grouping separator every three digits (e.g. "1234567.89" -> de-DE "1.234.567,89");
 * grouped=false only swaps the decimal separator (e.g. "1234567.89" -> "1234567,89"), used while the
 * field is focused so grouping separators don't interfere with editing. Returns '' for empty input.
 */
export function formatPlainToLocale(plain, locale, grouped) {
    const str = (plain || '').toString();
    if (!str) {
        return '';
    }
    const dotIdx = str.indexOf('.');
    const intPart = dotIdx === -1 ? str : str.substring(0, dotIdx);
    const fracPart = dotIdx === -1 ? '' : str.substring(dotIdx + 1);
    const dec = decimalSeparator(locale);
    let intOut = intPart;
    if (grouped) {
        const grp = groupSeparator(locale);
        if (grp) {
            intOut = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, grp);
        }
    }
    return dotIdx === -1 ? intOut : `${intOut}${dec}${fracPart}`;
}

/**
 * Parse a locale-formatted amount string (as the user sees it in the field) into the plain
 * dot-decimal form used internally and emitted to Flow, e.g. de-DE "1.234,56" -> "1234.56",
 * en-US "1,234.56" -> "1234.56". Purely string-based — no Number() round-trip — so amounts beyond
 * Number.MAX_SAFE_INTEGER keep every digit.
 */
export function toPlainNumberString(rawValue, locale) {
    const str = (rawValue || '').toString();
    if (!str) {
        return '';
    }
    const dec = decimalSeparator(locale);
    const firstDec = str.indexOf(dec);
    let intPart = firstDec === -1 ? str : str.substring(0, firstDec);
    let fracPart = firstDec === -1 ? '' : str.substring(firstDec + 1);
    // Everything that isn't a digit (grouping separators, currency symbols, stray letters) is noise.
    intPart = intPart.replace(/[^0-9]/g, '');
    fracPart = fracPart.replace(/[^0-9]/g, '');
    if (firstDec === -1) {
        return intPart;
    }
    return `${intPart}.${fracPart}`;
}

/**
 * Keystroke-level filter for the amount field while the user types in locale form. Keeps digits and
 * at most one decimal separator (the locale's), drops grouping separators and any other characters,
 * and trims the fraction to the currency's precision without ever dropping the separator itself
 * (the reported bug: a rejected 3rd fraction digit must not collapse "25,50" into "2550"). A second
 * decimal separator is ignored, but digits typed after it still count toward the fraction. With
 * decimals === 0 the separator is removed entirely. Purely string-based, so high-precision integers
 * survive unchanged.
 */
export function sanitizeLocaleAmountInput(rawValue, decSep, decimals) {
    const str = (rawValue || '').toString();
    if (!str) {
        return '';
    }
    const firstSep = str.indexOf(decSep);
    let intPart = firstSep === -1 ? str : str.substring(0, firstSep);
    let fracPart = firstSep === -1 ? '' : str.substring(firstSep + 1);
    intPart = intPart.replace(/[^0-9]/g, '');
    fracPart = fracPart.replace(/[^0-9]/g, '');
    if (firstSep === -1 || decimals === 0) {
        return intPart;
    }
    if (fracPart.length > decimals) {
        fracPart = fracPart.substring(0, decimals);
    }
    return `${intPart}${decSep}${fracPart}`;
}

/**
 * Localized currency name via Intl.DisplayNames, following FinTech i18n standards.
 * - withCode=false (default): just the name, e.g. en "Euro" / fr "euro".
 * - withCode=true: "CODE - name" when a distinct name exists, else the bare code,
 *   e.g. fr-FR "EUR - euro", en-US "EUR - Euro".
 * Falls back to the code when the name is unavailable.
 */
export function localizedCurrencyName(code, locale, withCode = false) {
    if (!code) {
        return '';
    }
    try {
        const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code);
        if (!name || name.toLowerCase() === code.toLowerCase()) {
            return code;
        }
        return withCode ? `${code} - ${name}` : name;
    } catch {
        return code;
    }
}
