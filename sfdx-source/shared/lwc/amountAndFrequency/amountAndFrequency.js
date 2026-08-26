import { LightningElement, api } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import { currencyLocale,
    localizedCurrencyName,
    currencyDecimals,
    currencySymbolInfo,
    normalizeCurrency,
    decimalSeparator,
    toPlainNumberString,
    sanitizeLocaleAmountInput,
    formatPlainToLocale
} from 'c/currencyUtils';
import { labels } from './amountAndFrequencyLabels';

// Re-export the pure amount helpers so consumers (and tests) can import them from the component.
export { toPlainNumberString, sanitizeLocaleAmountInput } from 'c/currencyUtils';

const DEFAULT_AMOUNTS_ONE_TIME  = '25,50,100,250,500,1000';
const DEFAULT_AMOUNTS_RECURRING = '5,10,25,60,125,250';
const DEFAULT_FREQ_1_VALUE      = 'oneTime';
const DEFAULT_FREQ_2_VALUE      = 'recurring';
// Module-level counter ensures unique DOM IDs when multiple instances are on the same page.
let _nextInstanceId = 0;

export default class AmountAndFrequency extends LightningElement {
    _instanceId = ++_nextInstanceId;
    _frequency = DEFAULT_FREQ_1_VALUE;
    _selectedPresetOneTime   = null;
    _selectedPresetRecurring = null;
    _customAmount = '';
    _internalErrorToRender   = '';
    _cachedExternalErrorMessage = '';
    _externalErrorToRender   = '';
    _hasUserInteracted       = false;
    _focusTimer              = null;
    _currencyCode            = '';
    _minAmount               = 1;
    _maxAmount               = 0;
    // True while the amount field is focused: display drops grouping separators for stable editing;
    // at rest they are shown. Reactive because customAmountDisplay reads it.
    _isEditing               = false;

    labels = labels;

    @api freq1Value = DEFAULT_FREQ_1_VALUE;
    @api freq2Value = DEFAULT_FREQ_2_VALUE;
    @api showFrequencyToggle   = false;

    @api presetAmountsOneTime   = DEFAULT_AMOUNTS_ONE_TIME;
    @api presetAmountsRecurring = DEFAULT_AMOUNTS_RECURRING;

    @api defaultFrequency = '';

    @api
    get minAmount() {
        return this._minAmount;
    }
    set minAmount(value) {
        this._minAmount = value;
        this._updateRenderedInternalError();
    }

    @api
    get maxAmount() {
        return this._maxAmount;
    }
    set maxAmount(value) {
        this._maxAmount = value;
        this._updateRenderedInternalError();
    }

    @api
    get currencyCode() {
        return this._currencyCode;
    }
    set currencyCode(value) {
        // Validate as ISO 4217: a misconfigured Flow variable (e.g. a label instead of a code) must
        // not reach the UI, or the raw text would render as the currency symbol and in preset labels.
        // An invalid value normalizes to '' — the form then shows plain, symbol-less amounts.
        const next = normalizeCurrency(value, true);
        if (this._currencyCode === next) return;
        this._currencyCode = next;
        // Clear custom amount if it has more decimal places than the new currency allows.
        // Rounding or truncating silently would change the payment amount without user awareness,
        // which is unacceptable for a payment form — the user must re-enter the amount explicitly.
        if (this._customAmount !== '') {
            const dotIdx = this._customAmount.indexOf('.');
            const decimals = this._currencyDecimals;
            if (dotIdx !== -1 && this._customAmount.length - dotIdx - 1 > decimals) {
                this._customAmount = '';
            }
        }
        this._updateRenderedInternalError();
        // Re-emit so the selectedCurrency flow output tracks a currency that changes at runtime
        // (e.g. bound to the currencyPicker). connectedCallback also emits the initial value.
        this._dispatchChange();
    }

    @api
    get frequency() {
        return this._frequency;
    }
    set frequency(value) {
        if (value) {
            this._frequency = value;
            this._updateRenderedInternalError();
        }
    }

    // Numeric view of the active amount — used only for boolean/range checks, never for the emitted
    // value (Number would corrupt digits beyond Number.MAX_SAFE_INTEGER).
    get _amount() {
        if (this._customAmount !== '') {
            const n = Number(this._customAmount);
            return isNaN(n) ? null : n;
        }
        return this._selectedPreset;
    }

    // Exact string form of the active amount for the emitted Flow output. A custom amount is passed
    // through verbatim (never via Number) so trailing zeros and digits beyond Number.MAX_SAFE_INTEGER
    // survive; a preset — always a safe integer — is stringified.
    get _amountString() {
        if (this._customAmount !== '') {
            return this._customAmount;
        }
        return this._selectedPreset !== null ? String(this._selectedPreset) : null;
    }

    @api
    get amountOneTime() {
        if (this._frequency !== 'oneTime') return null;
        return this._amountString;
    }

    @api
    get amountRecurring() {
        if (this._frequency !== 'recurring') return null;
        return this._amountString;
    }

    @api
    get isAmountSelected() {
        return this._amount !== null && this._amount > 0;
    }

    // Exposes the active currency as a flow output so downstream steps (e.g. the PaymentIntent)
    // can read the currency from this component. This keeps the form self-sufficient when the
    // currencyPicker is removed and the currency is configured directly on this component.
    @api
    get selectedCurrency() {
        return this._currencyCode;
    }

    // Routes preset read/write to the bucket that matches the active frequency.
    get _selectedPreset() {
        return this._frequency === this.freq2Value
            ? this._selectedPresetRecurring
            : this._selectedPresetOneTime;
    }
    set _selectedPreset(val) {
        if (this._frequency === this.freq2Value) {
            this._selectedPresetRecurring = val;
        } else {
            this._selectedPresetOneTime = val;
        }
    }

    get _locale() {
        return currencyLocale();
    }

    get frequencyGroupName(){
        return `frequency-${this._instanceId}`;
    }

    get presetName() {
        return `preset-${this._instanceId}`;
    }

    get frequencyOnceId() {
        return `freq-1-${this._instanceId}`;
    }

    get frequencyMonthlyId() {
        return `freq-2-${this._instanceId}`;
    }

    get customAmountId() {
        return `custom-amount-${this._instanceId}`;
    }

    get customAmountErrorId() {
        return `custom-amount-error-${this._instanceId}`;
    }

    get currencyDescriptionId() {
        return `currency-desc-${this._instanceId}`;
    }

    get amountRequiredErrorId() {
        return `amount-required-error-${this._instanceId}`;
    }

    get externalErrorId() {
        return `amount-external-error-${this._instanceId}`;
    }

    get customAmountDescribedBy() {
        // Only reference error nodes while they exist — a dangling IDREF is an a11y defect.
        const ids = [this.currencyDescriptionId];
        if (this.hasValidationError) ids.push(this.customAmountErrorId);
        if (this.hasRequiredError)   ids.push(this.amountRequiredErrorId);
        if (this.hasExternalError)   ids.push(this.externalErrorId);
        return ids.join(' ');
    }

    // Localized currency name for assistive text, e.g. "Euro" (en) / "euro" (fr).
    get _currencyName() {
        return localizedCurrencyName(this.currencyCode, this._locale);
    }

    // e.g. "Amount in Euro" — read out when the amount input gains focus, since the visual currency symbol is decorative
    get currencyAssistiveText() {
        const name = this._currencyName;
        return name ? this.labels.ec_label_amount_in_currency.replace('{0}', name) : '';
    }

    get isFreq1Selected() {
        return this._frequency === this.freq1Value;
    }

    get isFreq2Selected() {
        return this._frequency === this.freq2Value;
    }

    get showPresets() {
        const p = this._resolveActivePresets();
        return p !== null && p.length > 0;
    }

    get presetAmountOptions() {
        const presets = this._resolveActivePresets() || [];
        return presets.map(amount => ({
            value:      amount,
            label:      this._formatPresetAmount(amount, this.currencyCode, this._locale),
            inputId:    `${this._instanceId}-preset-${amount}`,
            isSelected: this._selectedPreset === amount && this._customAmount === ''
        }));
    }

    get _symbolInfo() {
        return currencySymbolInfo(this.currencyCode, this._locale);
    }

    get currencySymbol() {
        return this._symbolInfo.symbol;
    }

    get isCurrencyPrefix() {
        return this._symbolInfo.position === 'prefix';
    }

    get isCurrencySuffix() {
        return this._symbolInfo.position === 'suffix';
    }

    get customAmountMin() {
        return Number(this.minAmount) || 1;
    }

    get customAmountMax() {
        const n = Number(this.maxAmount);
        return n > 0 ? n : null;
    }

    get _currencyDecimals() {
        return currencyDecimals(this.currencyCode, this._locale);
    }

    get _decimalSeparator() {
        return decimalSeparator(this._locale);
    }

    // Locale-formatted view of the amount bound to the input. At rest it carries grouping separators
    // (e.g. de-DE "1.234.567,89"); while editing they are dropped ("1234567,89") so keystrokes and
    // the caret aren't disrupted. Reactive: re-renders when _customAmount, _isEditing, or the
    // currency (hence locale/precision) changes — the field re-groups without waiting for a focus.
    get customAmountDisplay() {
        return formatPlainToLocale(this._customAmount, this._locale, !this._isEditing);
    }

    get validationError() {
        return this.hasValidationError ? this._internalErrorToRender : '';
    }

    get hasValidationError() {
        return !!this._internalErrorToRender && this._customAmount !== '';
    }

    get requiredError() {
        return this.hasRequiredError ? this._internalErrorToRender : '';
    }

    get hasRequiredError() {
        return !!this._internalErrorToRender && this._customAmount === '';
    }

    get externalError() {
        return this._externalErrorToRender;
    }

    get hasExternalError() {
        return !!this._externalErrorToRender;
    }

    // Marks the custom amount field invalid for any currently rendered component error.
    get isAmountInvalid() {
        return this.hasValidationError || this.hasRequiredError || this.hasExternalError;
    }

    get customAmountRowClass() {
        return this.isAmountInvalid
            ? 'custom-amount-row custom-amount-row--error'
            : 'custom-amount-row';
    }

    @api validate() {
        // Flow calls reportValidity() separately to render the error (and move focus), so validate()
        // only reports internal validity without changing any visible UI state.
        const errorMessage = this._getInternalErrorMessageIfInvalid();
        this._saveState();
        return {
            isValid: !errorMessage,
            errorMessage: errorMessage || null
        };
    }

    @api setCustomValidity(externalErrorMessage) {
        // Store only; reportValidity() is Flow's request to render. If an external error is already
        // visible, update it immediately so a reactive clear doesn't leave stale text on screen.
        const wasRenderingExternalError = !!this._externalErrorToRender;
        this._cachedExternalErrorMessage = externalErrorMessage || '';
        if (wasRenderingExternalError) {
            this._externalErrorToRender = this._cachedExternalErrorMessage;
        }
    }

    @api reportValidity() {
        // Flow explicitly requests that all current internal and external errors be rendered.
        this._internalErrorToRender = this._getInternalErrorMessageIfInvalid();
        this._externalErrorToRender = this._cachedExternalErrorMessage;
        clearTimeout(this._focusTimer);
        this._focusTimer = null;
        if (this._internalErrorToRender) {
            this._focusTimer = requestAnimationFrame(() => {
                this.template.querySelector('.custom-amount-input-native')?.focus();
            });
        }
        this._saveState();
    }

    connectedCallback() {
        if (this.defaultFrequency) {
            this._frequency = this.defaultFrequency;
        }
        this._restoreState();
        this._applyQueryParams();

        if (this._customAmount !== '') {
            this._customAmount = this._trimToCurrencyDecimals(this._customAmount);
        }

        this._dispatchChange();
    }

    disconnectedCallback() {
        clearTimeout(this._focusTimer);
        this._saveState();
    }

    handleFrequencyChange(event) {
        this._hasUserInteracted = true;
        this._frequency = event.target.value;
        this._updateRenderedInternalError();
        this._dispatchChange();
    }

    handlePresetAmountSelect(event) {
        this._hasUserInteracted = true;
        this._selectedPreset = Number(event.target.value);
        this._customAmount    = '';
        this._updateRenderedInternalError();
        this._dispatchChange();
    }

    handleCustomAmountInput(event) {
        this._hasUserInteracted = true;
        // Filter the raw locale input (strip grouping/junk, trim the fraction) and write the cleaned
        // locale form straight back so the field never shows characters we rejected.
        const display = sanitizeLocaleAmountInput(event.target.value, this._decimalSeparator, this._currencyDecimals);
        event.target.value = display;
        // Store the plain dot-decimal form — string-based, so huge amounts keep every digit.
        this._customAmount   = toPlainNumberString(display, this._locale);
        this._selectedPreset = this._customAmount !== '' ? null : this._selectedPreset;
        this._updateRenderedInternalError();
        this._dispatchChange();
    }

    handleCustomAmountFocus(event) {
        this._isEditing = true;
        event.target.value = formatPlainToLocale(this._customAmount, this._locale, false);
    }

    handleCustomAmountBlur(event) {
        // Restore grouping separators at rest, imperatively for the same synchronous-update reason.
        this._isEditing = false;
        event.target.value = formatPlainToLocale(this._customAmount, this._locale, true);
    }

    // Trim a plain dot-decimal amount that arrives outside the input handler — restored from
    // sessionStorage or an ?amount= query param — to the active currency's precision. A stored
    // "10.50" survives for a 2-decimal currency but becomes "10" for JPY (and "999.999" -> "999.99"
    // for EUR). String-based so huge amounts keep every digit. Unlike a runtime currencyCode change
    // (which clears an over-precise custom amount so the payer re-enters it), this runs at mount for
    // a value the user never sees mid-edit, so trimming to the current currency is least surprising.
    _trimToCurrencyDecimals(value) {
        const str = (value || '').toString();
        const dotIdx = str.indexOf('.');
        if (dotIdx === -1) {
            return str;
        }
        const decimals = this._currencyDecimals;
        if (decimals === 0) {
            return str.substring(0, dotIdx);
        }
        if (str.length - dotIdx - 1 > decimals) {
            return str.substring(0, dotIdx + decimals + 1);
        }
        return str;
    }

    _parseAmounts(raw) {
        if (!raw || !String(raw).trim()) return null;
        const parsed = String(raw)
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n) && n > 0);
        return parsed.length > 0 ? parsed : null;
    }

    _formatPresetAmount(amount, currencyCode, locale) {
        try {
            // Without a currency, fall back to a plain localized number instead of a placeholder
            // currency so the form never shows amounts in a currency the payer didn't pick.
            const options = currencyCode
                ? { style: 'currency', currency: currencyCode, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0 }
                : { style: 'decimal', minimumFractionDigits: 0 };
            return new Intl.NumberFormat(locale, options).format(amount);
        } catch {
            return `${currencyCode} ${amount}`.trim();
        }
    }

    _resolveActivePresets() {
        const raw = this._frequency === this.freq2Value
            ? this.presetAmountsRecurring
            : this.presetAmountsOneTime;
        return this._parseAmounts(raw);
    }

    _getRangeErrorMessageIfInvalid() {
        if (this._customAmount === '') {
            return '';
        }
        const num = Number(this._customAmount);
        const min = this.customAmountMin;
        const max = this.customAmountMax;
        if (isNaN(num) || num < min) {
            return this.labels.ec_label_amount_min_error.replace(
                '{0}',
                this._formatPresetAmount(min, this.currencyCode, this._locale)
            );
        }
        if (max !== null && num > max) {
            return this.labels.ec_label_amount_max_error.replace(
                '{0}',
                this._formatPresetAmount(max, this.currencyCode, this._locale)
            );
        }
        return '';
    }

    _getInternalErrorMessageIfInvalid() {
        return this._getRangeErrorMessageIfInvalid()
            || (!this.isAmountSelected ? this.labels.ec_label_amount_required : '');
    }

    _updateRenderedInternalError() {
        // Once an internal error is visible, keep it reactive even if the change came from Flow
        // rather than direct user input. Before interaction/reportValidity(), keep the first load clean.
        if (this._hasUserInteracted || this._internalErrorToRender) {
            this._internalErrorToRender = this._getInternalErrorMessageIfInvalid();
        }
    }

    _dispatchChange() {
        const detail = {
            frequency:        this._frequency,
            amountOneTime:    this.amountOneTime,
            amountRecurring:  this.amountRecurring,
            isAmountSelected: this.isAmountSelected,
            currency:         this.currencyCode
        };
        this.dispatchEvent(new CustomEvent('amountfrequencychange', { detail }));
        this.dispatchEvent(new FlowAttributeChangeEvent('frequency',        detail.frequency));
        this.dispatchEvent(new FlowAttributeChangeEvent('amountOneTime',    detail.amountOneTime));
        this.dispatchEvent(new FlowAttributeChangeEvent('amountRecurring',  detail.amountRecurring));
        this.dispatchEvent(new FlowAttributeChangeEvent('isAmountSelected', detail.isAmountSelected));
        this.dispatchEvent(new FlowAttributeChangeEvent('selectedCurrency', detail.currency));
    }

    _storageKey() {
        try { return `af-state-${window.location.pathname}`; } catch { return 'af-state'; }
    }

    _saveState() {
        try {
            sessionStorage.setItem(this._storageKey(), JSON.stringify({
                frequency:      this._frequency,
                selectedPreset: this._selectedPreset,
                customAmount:   this._customAmount
            }));
        } catch { /* sessionStorage unavailable */ }
    }

    _restoreState() {
        try {
            const raw = sessionStorage.getItem(this._storageKey());
            if (!raw) return;
            const s = JSON.parse(raw);
            if (s.frequency)                    this._frequency      = s.frequency;
            if (s.selectedPreset !== undefined) this._selectedPreset = s.selectedPreset;
            if (s.customAmount   !== undefined) this._customAmount   = s.customAmount;
        } catch { /* ignore parse errors */ }
    }

    _applyQueryParams() {
        try {
            const params     = new URLSearchParams(window.location.search);
            const qAmount    = params.get('amount');
            const qFrequency = params.get('frequency');

            if (qFrequency) this._frequency = qFrequency;

            if (qAmount) {
                const num    = Number(qAmount);
                const presets = this._resolveActivePresets();
                if (!isNaN(num) && num > 0) {
                    if (presets && presets.includes(num)) {
                        this._selectedPreset = num;
                    } else {
                        this._customAmount = String(num);
                    }
                }
            }
        } catch {
            // window.location unavailable in SSR / test environments.
        }
    }
}
