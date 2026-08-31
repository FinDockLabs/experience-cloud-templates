import { api, LightningElement } from 'lwc';
import getActiveCurrencies from '@salesforce/apex/CurrencyPickerController.getActiveCurrencies';
import { ISO_CODE, dedupe, normalizeCurrency } from 'c/currencyUtils';

const FLOW_VAR_OPTION = 'USE_FLOW_VARIABLE';
const LABELS = {
    defaultNotOffered: (code) =>
        `Default currency "${code}" is not active or is not included in the offered currencies.`,
    inactiveCurrencies: (codes) =>
        `These offered currencies are not active in your org: ${codes}.`,
    invalidIsoCode: (value) =>
        `"${value}" is not a valid ISO 4217 currency code (for example, EUR or USD).`,
    selectDefault: 'Select a default currency source.',
    selectVariable: 'Select the Flow variable that provides the default currency.',
    useFlowVariable: 'Use Flow variable...'
};

export default class CurrencyPickerConfig extends LightningElement {
    @api builderContext;
    @api genericTypeMappings;
    @api automaticOutputVariables;

    @api
    get inputVariables() {
        return this._inputVariables;
    }
    set inputVariables(value) {
        this._inputVariables = Array.isArray(value) ? value : [];
        if (!this._hydrated) {
            this._hydrated = true;
            this._hydrate();
        }
    }

    showVariableInput = false;
    comboboxValue = '';
    _allowedCurrenciesError = '';
    _allowedCurrenciesValue = [];
    _currenciesLoadFailed = false;
    _currenciesLoaded = false;
    _defaultCurrencyError = '';
    _defaultCurrencyValue = '';
    _defaultCurrencyValueType = 'String';
    _hydrated = false;
    _inactiveConfiguredCurrencies = [];
    _inputVariables = [];
    _orgCurrencies = [];

    get currencyOptions() {
        const currencies =
            this._currenciesLoaded && !this._currenciesLoadFailed
                ? this._orgCurrencies
                : dedupe([...this._orgCurrencies, ...this.allowedValue]);

        return currencies.map((code) => ({
            label: code,
            value: code
        }));
    }

    get allowedValue() {
        return this._allowedCurrenciesValue;
    }

    get allowedCurrenciesError() {
        return this._allowedCurrenciesError;
    }

    get defaultCandidates() {
        return this.allowedValue.length ? this.allowedValue : this._orgCurrencies;
    }

    get defaultOptions() {
        const options = this.defaultCandidates.map((code) => ({
            label: code,
            value: code
        }));

        options.unshift({
            label: LABELS.useFlowVariable,
            value: FLOW_VAR_OPTION
        });

        return options;
    }

    get defaultCurrencyValue() {
        return this._defaultCurrencyValue;
    }

    get defaultCurrencyValueType() {
        return this._defaultCurrencyValueType;
    }

    get showAllowed() {
        if (!this._currenciesLoaded) {
            return false;
        }
        if (this._currenciesLoadFailed) {
            return this.allowedValue.length > 0;
        }
        return this._orgCurrencies.length > 1 || this._inactiveConfiguredCurrencies.length > 0;
    }

    get showSingleCurrencyNotice() {
        return (
            this._currenciesLoaded &&
            !this._currenciesLoadFailed &&
            this._orgCurrencies.length === 1
        );
    }

    get showDefaultSelector() {
        return !this.showSingleCurrencyNotice;
    }

    get defaultCurrencyError() {
        return this._defaultCurrencyError;
    }

    @api
    validate() {
        this._allowedCurrenciesError = this._getAllowedCurrenciesError();
        this._defaultCurrencyError = this._getDefaultCurrencyError();

        const errors = [];
        if (this._allowedCurrenciesError) {
            errors.push({
                key: 'allowedCurrencies',
                errorString: this._allowedCurrenciesError
            });
        }
        if (this._defaultCurrencyError) {
            errors.push({
                key: 'defaultCurrency',
                errorString: this._defaultCurrencyError
            });
        }
        return errors;
    }

    connectedCallback() {
        this._loadActiveCurrencies();
    }

    _loadActiveCurrencies() {
        getActiveCurrencies()
            .then((currencies) => {
                this._orgCurrencies = dedupe(
                    (currencies || []).map((code) => normalizeCurrency(code)).filter(Boolean)
                );
                this._reconcileAllowedCurrencies();
                this._applySingleCurrency();
            })
            .catch(() => {
                this._currenciesLoadFailed = true;
            })
            .finally(() => {
                this._currenciesLoaded = true;
            });
    }

    _getDefaultCurrencyError() {
        if (this.showSingleCurrencyNotice) {
            return '';
        }
        if (!this.comboboxValue) {
            return LABELS.selectDefault;
        }
        if (this.comboboxValue === FLOW_VAR_OPTION && !this._defaultCurrencyValue) {
            return LABELS.selectVariable;
        }
        if (
            this.comboboxValue === FLOW_VAR_OPTION &&
            this._defaultCurrencyValueType === 'String' &&
            !ISO_CODE.test(this._defaultCurrencyValue)
        ) {
            return LABELS.invalidIsoCode(this._defaultCurrencyValue);
        }
        if (
            this.comboboxValue !== FLOW_VAR_OPTION &&
            !ISO_CODE.test(this.comboboxValue)
        ) {
            return LABELS.invalidIsoCode(this.comboboxValue);
        }
        if (
            this.comboboxValue !== FLOW_VAR_OPTION &&
            this.defaultCandidates.length &&
            !this.defaultCandidates.includes(this.comboboxValue)
        ) {
            return LABELS.defaultNotOffered(this.comboboxValue);
        }
        return '';
    }

    _getAllowedCurrenciesError() {
        if (!this._currenciesLoaded || this._currenciesLoadFailed) {
            return '';
        }

        return this._inactiveConfiguredCurrencies.length
            ? LABELS.inactiveCurrencies(this._inactiveConfiguredCurrencies.join(', '))
            : '';
    }

    _reconcileAllowedCurrencies() {
        if (!this._allowedCurrenciesValue.length) {
            this._inactiveConfiguredCurrencies = [];
            return;
        }

        const configuredCurrencies = this._allowedCurrenciesValue;
        const activeConfiguredCurrencies = configuredCurrencies.filter((code) =>
            this._orgCurrencies.includes(code)
        );
        const inactiveConfiguredCurrencies = configuredCurrencies.filter(
            (code) => !this._orgCurrencies.includes(code)
        );

        this._allowedCurrenciesValue = activeConfiguredCurrencies;

        if (this._orgCurrencies.length === 1) {
            this._inactiveConfiguredCurrencies = [];
            this._allowedCurrenciesValue = [];
            this._dispatch('allowedCurrencies', '');
        } else if (activeConfiguredCurrencies.length) {
            this._inactiveConfiguredCurrencies = [];
            if (inactiveConfiguredCurrencies.length) {
                this._dispatch('allowedCurrencies', activeConfiguredCurrencies.join(','));
            }
        } else {
            this._inactiveConfiguredCurrencies = inactiveConfiguredCurrencies;
        }
    }

    _applySingleCurrency() {
        if (this._orgCurrencies.length !== 1) {
            return;
        }

        const singleCurrency = this._orgCurrencies[0];
        const shouldUpdateDefault =
            this.comboboxValue !== singleCurrency ||
            this._defaultCurrencyValueType !== 'String';

        this.comboboxValue = singleCurrency;
        this._defaultCurrencyValue = singleCurrency;
        this._defaultCurrencyValueType = 'String';
        this.showVariableInput = false;

        if (shouldUpdateDefault) {
            this._dispatch('defaultCurrency', singleCurrency);
        }
    }

    _hydrate() {
        this._allowedCurrenciesValue = dedupe(
            (this._get('allowedCurrencies') || '')
                .split(',')
                .map((code) => normalizeCurrency(code))
                .filter(Boolean)
        );

        const currentVariable = this._getVariable('defaultCurrency');
        this._defaultCurrencyValue = currentVariable?.value ?? '';
        this._defaultCurrencyValueType = currentVariable?.valueDataType ?? 'String';

        const value = this._defaultCurrencyValue;
        const valueType = (this._defaultCurrencyValueType || '').toLowerCase();
        const isFlowVariable = valueType === 'reference' || valueType === 'formula';

        if (isFlowVariable && value) {
            this.comboboxValue = FLOW_VAR_OPTION;
            this.showVariableInput = true;
        } else {
            this.comboboxValue = value;
            this.showVariableInput = false;
        }
    }

    _get(name) {
        return this._inputVariables.find((variable) => variable.name === name)?.value;
    }

    _getVariable(name) {
        return this._inputVariables.find((variable) => variable.name === name);
    }

    _dispatch(name, value, newValueDataType = 'String') {
        this.dispatchEvent(
            new CustomEvent('configuration_editor_input_value_changed', {
                bubbles: true,
                cancelable: false,
                composed: true,
                detail: { name, newValue: value, newValueDataType }
            })
        );
    }

    handleAllowedChange(event) {
        const selectedCurrencies = dedupe(
            (event.detail.value || []).map((code) => normalizeCurrency(code)).filter(Boolean)
        );
        this._allowedCurrenciesValue = selectedCurrencies;
        this._allowedCurrenciesError = '';
        this._inactiveConfiguredCurrencies = [];
        this._dispatch('allowedCurrencies', selectedCurrencies.join(','));

        if (
            selectedCurrencies.length &&
            this.comboboxValue !== FLOW_VAR_OPTION &&
            this.comboboxValue &&
            !selectedCurrencies.includes(this.comboboxValue)
        ) {
            this.comboboxValue = '';
            this._defaultCurrencyValue = '';
            this._defaultCurrencyValueType = 'String';
            this.showVariableInput = false;
            this._dispatch('defaultCurrency', '');
        }
    }

    handleComboboxChange(event) {
        const selectedValue = event.detail.value;
        this.comboboxValue = selectedValue;
        this._defaultCurrencyError = '';

        if (selectedValue === FLOW_VAR_OPTION) {
            this.showVariableInput = true;
            this._dispatch(
                'defaultCurrency',
                this._defaultCurrencyValue,
                this._defaultCurrencyValueType
            );
        } else {
            this.showVariableInput = false;
            this._defaultCurrencyValue = selectedValue;
            this._defaultCurrencyValueType = 'String';
            this._dispatch('defaultCurrency', selectedValue);
        }
    }

    handleVariableChange(event) {
        const valueType = event.detail.newValueDataType ?? 'String';
        const rawValue = event.detail.newValue ?? '';
        const value = valueType === 'String' ? rawValue.trim().toUpperCase() : rawValue;

        this._defaultCurrencyValue = value;
        this._defaultCurrencyValueType = valueType;
        this._defaultCurrencyError = '';
        this._dispatch('defaultCurrency', value, valueType);
    }
}
