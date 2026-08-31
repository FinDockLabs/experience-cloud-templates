import { api, LightningElement, track } from 'lwc';
import CURRENCY from '@salesforce/i18n/currency';
import getActiveCurrencies from '@salesforce/apex/CurrencyPickerController.getActiveCurrencies';
import { ISO_CODE, dedupe, normalizeCurrency, currencyDecimals, currencySymbolInfo, sanitizeAmountInput} from 'c/currencyUtils';

const PRESET_COUNT = 6;

const DEFAULT_AMOUNTS_ONE_TIME  = [25, 50, 100, 250, 500, 1000];
const DEFAULT_AMOUNTS_RECURRING = [5, 10, 25, 60, 125, 250];

function makePresets(amountStr, defaults) {
    const amounts = amountStr
        ? String(amountStr).split(',').map(s => { const n = Number(s.trim()); return n > 0 ? n : ''; })
        : [...defaults];
    return Array.from({ length: PRESET_COUNT }, (_, i) => ({
        index:  i,
        key:    `p-${i}`,
        label:  `Preset ${i + 1}`,
        amount: amounts[i] !== undefined ? amounts[i] : ''
    }));
}

function toAmountString(presets) {
    const parts = presets.map(p =>
        (p.amount !== '' && Number(p.amount) > 0) ? String(Number(p.amount)) : ''
    );
    while (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts.join(',');
}

export default class AmountAndFrequencyConfig extends LightningElement {
    @api builderContext;
    @api automaticOutputVariables;

    _inputVariables = [];
    _hydrated = false;

    @api
    get inputVariables() {
        return this._inputVariables;
    }
    set inputVariables(value) {
        this._inputVariables = value;
        if (!this._hydrated) {
            this._hydrated = true;
            this._hydrate();
        }
    }

    @track _presetsOneTime   = makePresets('', DEFAULT_AMOUNTS_ONE_TIME);
    @track _presetsRecurring = makePresets('', DEFAULT_AMOUNTS_RECURRING);

    _previewCurrency = '';
    _showOneTime = true;
    _showMonthly = true;
    _defaultFrequency = 'oneTime';
    _minAmount = 0;
    _maxAmount = 0;
    _currencyValue = '';
    _currencyValueType = 'String';
    _currencyError = '';

    get showOneTime() {
        return this._showOneTime;
    }

    get showMonthly() {
        return this._showMonthly;
    }

    get minAmount() {
        return this._minAmount === 0 ? '' : this._minAmount;
    }

    get maxAmount() {
        return this._maxAmount === 0 ? '' : this._maxAmount;
    }

    get frequencyOptions() {
        const opts = [];
        if (this._showOneTime) opts.push({ label: 'One-time', value: 'oneTime' });
        if (this._showMonthly) opts.push({ label: 'Monthly',  value: 'recurring' });
        return opts;
    }

    get defaultFrequency() {
        return this._defaultFrequency;
    }

    get showDefaultFrequency() {
        return this._showOneTime && this._showMonthly;
    }

    get showBothFrequencies() {
        return this._showOneTime && this._showMonthly;
    }

    get frequencyError() {
        return !this._showOneTime && !this._showMonthly ? 'Enable at least one frequency.' : '';
    }

    get presetsOneTime() {
        return this._presetsOneTime;
    }

    get presetsRecurring() {
        return this._presetsRecurring;
    }

    get minMaxError() {
        const min = Number(this._minAmount) || 0;
        const max = Number(this._maxAmount) || 0;
        return max > 0 && min > max ? 'Minimum cannot be greater than maximum.' : '';
    }

    get currencyValue() {
        return this._currencyValue;
    }

    get currencyValueType() {
        return this._currencyValueType;
    }

    get currencyError() {
        return this._currencyError;
    }

    // Currency used to render preview symbols in this editor: the literal ISO code entered here
    // when available, otherwise the org's active/default currency. A flow-variable reference
    // resolves only at runtime, so it can't drive the preview and falls back to the org currency.
    get _previewCurrencyCode() {
        const val = this._currencyValue;
        return val && ISO_CODE.test(val) ? val : this._previewCurrency;
    }

    get presetCurrencySymbol() {
        return currencySymbolInfo(this._previewCurrencyCode, 'en-US').symbol;
    }

    get _currencyDecimals() {
        return currencyDecimals(this._previewCurrencyCode, 'en-US');
    }

    connectedCallback() {
        this._loadActiveCurrencies();
    }

    _loadActiveCurrencies() {
        getActiveCurrencies()
            .then((currencies) => {
                const activeCurrencies = dedupe(
                    (currencies || []).map((code) => normalizeCurrency(code)).filter(Boolean)
                );
                const preferredCurrency = normalizeCurrency(CURRENCY);
                this._previewCurrency = activeCurrencies.includes(preferredCurrency)
                    ? preferredCurrency
                    : activeCurrencies[0] || '';
            })
            .catch(() => {
                this._previewCurrency = '';
            });
    }

    _sanitizeConfigAmountInput(event) {
        const val = sanitizeAmountInput(event.target.value, this._currencyDecimals);
        event.target.value = val;
        return val;
    }

    _sanitizePresetAmount(event) {
        return this._sanitizeConfigAmountInput(event);
    }

    _hydrate() {
        const vars = Array.isArray(this._inputVariables) ? this._inputVariables : [];
        const get  = name => { const v = vars.find(x => x.name === name); return v != null ? v.value : null; };

        const freq1 = get('freq1Value');
        const freq2 = get('freq2Value');

        if (freq1 === 'recurring') {
            this._showOneTime = false;
            this._showMonthly = true;
        } else if (freq2 === 'none') {
            this._showOneTime = true;
            this._showMonthly = false;
        } else {
            this._showOneTime = true;
            this._showMonthly = true;
        }

        this._defaultFrequency = get('defaultFrequency') ?? 'oneTime';
        this._minAmount        = get('minAmount')        ?? 0;
        this._maxAmount        = get('maxAmount')        ?? 0;

        const currencyVar = vars.find(x => x.name === 'currencyCode');
        if (currencyVar != null) {
            this._currencyValue     = currencyVar.value ?? '';
            this._currencyValueType = currencyVar.valueDataType ?? 'String';
        }

        this._presetsOneTime   = makePresets(get('presetAmountsOneTime'),   DEFAULT_AMOUNTS_ONE_TIME);
        this._presetsRecurring = makePresets(get('presetAmountsRecurring'), DEFAULT_AMOUNTS_RECURRING);
    }


    _emitFrequencyConfig() {
        if (this._showOneTime && this._showMonthly) {
            this._emit('freq1Value', 'oneTime');
            this._emit('freq2Value', 'recurring');
            this._emit('showFrequencyToggle', true, 'Boolean');
        } else if (this._showOneTime) {
            this._emit('freq1Value', 'oneTime');
            this._emit('freq2Value', 'none');
            this._emit('showFrequencyToggle', false, 'Boolean');
        } else if (this._showMonthly) {
            this._emit('freq1Value', 'recurring');
            this._emit('freq2Value', 'recurring');
            this._emit('showFrequencyToggle', false, 'Boolean');
        }
        this._emit('defaultFrequency', this._defaultFrequency);
    }

    _emit(name, newValue, newValueDataType = 'String') {
        this.dispatchEvent(new CustomEvent('configuration_editor_input_value_changed', {
            bubbles: true, composed: true,
            detail: { name, newValue, newValueDataType }
        }));
    }

    handleShowOneTimeChange(event) {
        this._showOneTime = event.target.checked;
        if (!this._showOneTime && this._defaultFrequency === 'oneTime') this._defaultFrequency = 'recurring';
        this._emitFrequencyConfig();
    }

    handleShowMonthlyChange(event) {
        this._showMonthly = event.target.checked;
        if (!this._showMonthly && this._defaultFrequency === 'recurring') this._defaultFrequency = 'oneTime';
        this._emitFrequencyConfig();
    }

    handleDefaultFrequencyChange(event) {
        this._defaultFrequency = event.detail.value;
        this._emit('defaultFrequency', this._defaultFrequency);
    }

    handlePresetOTAmountChange(event) {
        const idx    = Number(event.target.dataset.index);
        const amount = this._sanitizePresetAmount(event);
        this._presetsOneTime = this._presetsOneTime.map((p, i) => i === idx ? { ...p, amount } : p);
        this._emit('presetAmountsOneTime', toAmountString(this._presetsOneTime));
    }

    handlePresetRecAmountChange(event) {
        const idx    = Number(event.target.dataset.index);
        const amount = this._sanitizePresetAmount(event);
        this._presetsRecurring = this._presetsRecurring.map((p, i) => i === idx ? { ...p, amount } : p);
        this._emit('presetAmountsRecurring', toAmountString(this._presetsRecurring));
    }

    handleMinAmountInput(event) {
        this._sanitizeConfigAmountInput(event);
    }

    handleMinAmountChange(event) {
        const raw = event.target.value;
        const parsed = parseFloat(raw);
        if (!isNaN(parsed) && parsed > 0) {
            this._minAmount = parsed;
            this._emit('minAmount', parsed, 'Number');
        } else if (raw === '') {
            this._minAmount = 0;
            this._emit('minAmount', 0, 'Number');
        }
    }

    handleMaxAmountInput(event) {
        this._sanitizeConfigAmountInput(event);
    }

    handleMaxAmountChange(event) {
        const raw = event.target.value;
        const val = raw === '' ? 0 : parseFloat(raw);
        if (!isNaN(val) && val >= 0) {
            this._maxAmount = val;
            this._emit('maxAmount', val, 'Number');
        }
    }

    handleCurrencyChange(event) {
        const type = event.detail.newValueDataType ?? 'String';
        const raw  = event.detail.newValue ?? '';
        const val  = type === 'String' ? raw.trim().toUpperCase() : raw;

        // Validate literal codes only; a flow-variable reference resolves at runtime.
        this._currencyError = (type === 'String' && val && !ISO_CODE.test(val))
            ? `"${val}" is not a valid ISO 4217 currency code.`
            : '';

        this._currencyValue     = val;
        this._currencyValueType = type;
        this._emit('currencyCode', val, type);
    }
}
