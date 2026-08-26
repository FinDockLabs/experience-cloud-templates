import { createElement } from 'lwc';
import ExperienceProgressStages from 'c/experienceProgressStages';

// toBeAccessible() is registered globally by jest.setup.a11y.js via @sa11y/jest setup().
// It runs axe-core with Salesforce preset rules covering WCAG 2.1 AA + WCAG 2.2 AA
// success criteria that can be verified automatically.

function createComponent(props = {}) {
    const element = createElement('c-experience-progress-stages', { is: ExperienceProgressStages });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-experience-progress-stages WCAG 2.2 AA accessibility', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.useRealTimers();
    });

    // ── 1. Stage 1 (default) ────────────────────────────────────────────────────
    // Covers: 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value
    // role="list" + role="listitem" structure must be valid; live region must exist.
    it('passes axe scan on stage 1 (default state)', async () => {
        const element = createComponent();
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 2. Stage 2 — first stage shows SVG checkmark ────────────────────────────
    // The checkmark SVG is inside aria-hidden="true", so axe must not flag it as
    // missing an accessible name (WCAG 1.1.1 Non-text Content).
    it('passes axe scan on stage 2 (first checkmark visible)', async () => {
        const element = createComponent({ currentStage: 2 });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 3. Stage 3 — two checkmarks visible ─────────────────────────────────────
    it('passes axe scan on stage 3 (two checkmarks visible)', async () => {
        const element = createComponent({ currentStage: 3 });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 4. All stages completed ──────────────────────────────────────────────────
    // currentStage > 3 triggers all three checkmark SVGs simultaneously.
    it('passes axe scan when all stages are completed (currentStage > 3)', async () => {
        const element = createComponent({ currentStage: 4 });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 5. Visual list is hidden from assistive technology ──────────────────────
    // Covers: WCAG 4.1.3 Status Messages
    // The visual progress bar carries aria-hidden="true" — the only AT channel is
    // the aria-live region. axe must not flag any orphaned list/listitem roles.
    it('has the visual progress list hidden from assistive technology', async () => {
        const element = createComponent({ currentStage: 2 });
        await Promise.resolve();

        const list = element.shadowRoot.querySelector('[role="list"]');
        expect(list.getAttribute('aria-hidden')).toBe('true');

        await expect(element).toBeAccessible();
    });

    // ── 6. aria-live region is present and assertive ─────────────────────────────
    // Covers: WCAG 4.1.3 Status Messages
    // Screen readers must receive an automatic announcement when the stage changes.
    // aria-live="assertive" interrupts the current reading to deliver the message.
    it('has an aria-live="assertive" region for screen reader announcements', async () => {
        const element = createComponent({ currentStage: 1 });
        await Promise.resolve();

        const liveRegion = element.shadowRoot.querySelector('[aria-live="assertive"]');
        expect(liveRegion).not.toBeNull();

        await expect(element).toBeAccessible();
    });

    // ── 7. Live region text is populated after the 250 ms render delay ──────────
    // Covers: WCAG 4.1.3 Status Messages
    // renderedCallback schedules a 250 ms setTimeout before setting announcementText
    // so the screen reader reliably captures the text change. We use fake timers to
    // verify the announcement is delivered without waiting in real time.
    it('populates the live region with a stage announcement after render', async () => {
        jest.useFakeTimers();
        const element = createComponent({ currentStage: 2 });
        await Promise.resolve();

        const liveRegion = element.shadowRoot.querySelector('[aria-live="assertive"]');
        expect(liveRegion.textContent).toBe('');

        jest.advanceTimersByTime(250);
        await Promise.resolve();

        expect(liveRegion.textContent).not.toBe('');

        // @sa11y/jest blocks axe when fake timers are active — restore before scanning.
        jest.useRealTimers();
        await expect(element).toBeAccessible();
    });

    // ── 8. Edge case: stage 0 / invalid value ────────────────────────────────────
    // normalizedCurrentStage clamps to 0 — no stage is active. The component must
    // still render a valid, accessible structure (no broken ARIA relationships).
    it('passes axe scan with currentStage set to 0 (graceful degradation)', async () => {
        const element = createComponent({ currentStage: 0 });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });
});
