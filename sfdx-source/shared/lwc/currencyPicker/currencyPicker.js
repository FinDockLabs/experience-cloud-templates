import { api, LightningElement } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import getActiveCurrencies from '@salesforce/apex/CurrencyPickerController.getActiveCurrencies';
import { currencyLocale, dedupe, localizedCurrencyName, normalizeCurrency} from 'c/currencyUtils';
import { labels } from './currencyPickerLabels';

const normalize = (code) => normalizeCurrency(code, true);

export default class CurrencyPicker extends LightningElement {
    @api allowedCurrencies = '';
    @api defaultCurrency = '';

    @api
    get value() {
        return this._value;
    }
    set value(val) {
        const code = normalize(val);
        const isSelectable = !this._currencies.length || this._currencies.includes(code);

        if (code && isSelectable && code !== this._value) {
            this._value = code;
            this._selected = code;
        }
    }

    labels = labels;
    _configuredCurrencies = [];
    _currencies = [];
    _hasConfiguredAllowList = false;
    _selected = '';
    _value = '';

    @api
    validate() {
        return {
            isValid: Boolean(this._value),
            errorMessage: this._value ? null : this.labels.ec_error_payment_methods_unavailable
        };
    }

    get options() {
        return this._currencies.map((code) => ({
            label: localizedCurrencyName(code, this._locale, true),
            value: code
        }));
    }

    get showPicker() {
        return this._currencies.length > 1;
    }

    get selectedCurrencyAssistiveText() {
        const label = localizedCurrencyName(this._value, this._locale, true);
        return `${this.labels.ec_label_currency}: ${label}`;
    }

    get _locale() {
        return currencyLocale();
    }

    connectedCallback() {
        this._hasConfiguredAllowList = Boolean((this.allowedCurrencies || '').trim());
        this._configuredCurrencies = dedupe(
            (this.allowedCurrencies || '').split(',').map(normalize).filter(Boolean)
        );
        // Restore the last picked currency before loading the list so _resolveInitial prefers it.
        this._restoreState();
        this._loadActiveCurrencies();
    }

    _loadActiveCurrencies() {
        getActiveCurrencies()
            .then((currencies) => {
                const activeCurrencies = dedupe(
                    (currencies || []).map(normalize).filter(Boolean)
                );
                const availableCurrencies = this._hasConfiguredAllowList
                    ? this._configuredCurrencies.filter((code) =>
                        activeCurrencies.includes(code)
                    )
                    : activeCurrencies;

                this._applyCurrencies(availableCurrencies);
            })
            .catch(() => {
                this._applyCurrencies([]);
            })
            .finally(() => this._emit());
    }

    _applyCurrencies(list) {
        this._currencies = list;
        this._value = this._resolveInitial();
    }

    _resolveInitial() {
        if (this._selected && this._currencies.includes(this._selected)) {
            return this._selected;
        }
        const preferred = normalize(this.defaultCurrency);
        if (preferred && this._currencies.includes(preferred)) {
            return preferred;
        }
        return this._currencies[0] || '';
    }

    _emit() {
        this.dispatchEvent(new CustomEvent('currencychange', { detail: { currency: this._value } }));
        this.dispatchEvent(new FlowAttributeChangeEvent('value', this._value));
    }

    handleChange(event) {
        this._value = event.detail.value;
        this._selected = event.detail.value;
        this._saveState();
        this._emit();
    }

    _storageKey() {
        try { return `cp-state-${window.location.pathname}`; } catch { return 'cp-state'; }
    }

    _saveState() {
        try {
            sessionStorage.setItem(this._storageKey(), JSON.stringify({ selected: this._selected }));
        } catch { /* sessionStorage unavailable */ }
    }

    _restoreState() {
        try {
            const raw = sessionStorage.getItem(this._storageKey());
            if (!raw) return;
            const s = JSON.parse(raw);
            const code = normalize(s.selected);
            if (code) this._selected = code;
        } catch { /* ignore parse errors */ }
    }
}
