import { LightningElement, api } from 'lwc';

// Mock of the managed cpm/flowFieldSet layout wrapper used by currencyPickerConfig.
export default class FlowFieldSet extends LightningElement {
    @api label;
    @api description;
}
