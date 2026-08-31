import { LightningElement, api } from 'lwc';

// Mock of the managed cpm/flowVariableInput Flow-resource picker used by currencyPickerConfig.
export default class FlowVariableInput extends LightningElement {
    @api name;
    @api label;
    @api variant;
    @api builderContextFilterType;
    @api value;
    @api valueType;
    @api builderContext;
    @api automaticOutputVariables;
}
