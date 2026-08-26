import { LightningElement, api } from 'lwc';
import { labels } from './experienceProgressStagesLabels';

const MAX_STAGE = 3;

export default class ExperienceProgressStages extends LightningElement {
    labels = labels;
    @api stage1Label = labels.ec_stage_label_amount;
    @api stage2Label = labels.ec_stage_label_information;
    @api stage3Label = labels.ec_stage_label_payment;
    @api currentStage = 1;
    // Track the live screen reader announcement string literal
    announcementText = '';

    get normalizedCurrentStage() {
        const parsed = Number(this.currentStage);

        if (Number.isNaN(parsed)) {
            return 0;
        }

        return Math.min(Math.max(Math.trunc(parsed), 0), MAX_STAGE);
    }

    /* Boolean flags to determine if a checkmark icon should replace the step number */
    get isStage1Completed() {
        return this.normalizedCurrentStage > 1;
    }

    get isStage2Completed() {
        return this.normalizedCurrentStage > 2;
    }

    get isStage3Completed() {
        return this.normalizedCurrentStage > 3;
    }

    /* Original Circle Class Getters */
    get stage1CircleClass() {
        return this.getCircleClass(1);
    }

    get stage2CircleClass() {
        return this.getCircleClass(2);
    }

    get stage3CircleClass() {
        return this.getCircleClass(3);
    }

    /* Original Number Class Getters */
    get stage1NumberClass() {
        return this.getNumberClass(1);
    }

    get stage2NumberClass() {
        return this.getNumberClass(2);
    }

    get stage3NumberClass() {
        return this.getNumberClass(3);
    }

    /* Original Connector Class Getters */
    get connectorOneClass() {
        return this.getConnectorClass(2);
    }

    get connectorTwoClass() {
        return this.getConnectorClass(3);
    }

    renderedCallback() {
        if (!this.announcementText) {
            // A short delay ensures the screen reader captures the text change smoothly
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => {
                // Dynamically replace the placeholder with the normalized step count
                this.announcementText = this.labels.ec_sr_progress_stage_announcement
                    .replace('{0}', String(this.normalizedCurrentStage));
            }, 250);
        }
    }

    getCircleClass(stageNumber) {
        const isActive = this.normalizedCurrentStage >= stageNumber;
        return `stage-progress__circle${isActive ? ' stage-progress__circle--active' : ''}`;
    }

    getNumberClass(stageNumber) {
        const isActive = this.normalizedCurrentStage >= stageNumber;
        return `stage-progress__number${isActive ? ' stage-progress__number--active' : ''}`;
    }

    getConnectorClass(requiredStage) {
        const isActive = this.normalizedCurrentStage >= requiredStage;
        return `stage-progress__connector${isActive ? ' stage-progress__connector--active' : ''}`;
    }
}
