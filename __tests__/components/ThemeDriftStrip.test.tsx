import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeDriftStrip } from '../../components/memory/ThemeDriftStrip';

const THEMES = ['mornings', 'calm', 'work'];
/** The run rows' class; the 8px seam is the prototype's `.theme-run` gap. */
const RUN_CLASS = 'flex-row items-baseline gap-2 pr-2';

/**
 * The rendered runs, host nodes only. A prop query in RNTL matches the
 * composite and the host instance of the same element, so counting without
 * this filter double-counts.
 */
function runHosts() {
    return screen
        .UNSAFE_queryAllByProps({ className: RUN_CLASS })
        .filter((node) => typeof node.type === 'string');
}

/** The scroller is the only host node carrying the scroll handlers. */
function scrollerHost() {
    const scroller = screen
        .UNSAFE_queryAllByProps({ horizontal: true })
        .find(
            (node) =>
                typeof node.type === 'string' &&
                typeof node.props.onLayout === 'function' &&
                typeof node.props.onScrollBeginDrag === 'function',
        );
    if (!scroller) throw new Error('the scroller host node was not rendered');
    return scroller;
}

/** Fire the `onLayout` a real layout pass would deliver, and flush the state it sets. */
function layoutAt(node: { props: Record<string, unknown> }, width: number) {
    act(() => {
        (node.props.onLayout as (event: unknown) => void)({
            nativeEvent: { layout: { x: 0, y: 0, width, height: 40 } },
        });
    });
}

describe('ThemeDriftStrip', () => {
    it('renders one focusable run and inert repeats', () => {
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        const [firstRun, ...repeats] = runHosts();

        // One button per theme — the repeats exist to make the offset periodic,
        // and a focusable element inside a duplicated run is a focus trap.
        expect(screen.getAllByRole('button')).toHaveLength(THEMES.length);
        // The query above skips accessibility-hidden subtrees, so it cannot see
        // buttons that are focus traps *and* hidden. Count those too.
        expect(screen.getAllByRole('button', { includeHiddenElements: true })).toHaveLength(
            THEMES.length,
        );

        // The counts alone would pass if the repeats were interactive but
        // hidden, so pin the prop that decides it.
        expect(repeats.length).toBeGreaterThan(0);
        expect(firstRun!.props['aria-hidden']).toBe(false);
        expect(repeats.every((run) => run.props['aria-hidden'] === true)).toBe(true);
    });

    it('sizes the content to the frame it is given', () => {
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        // Nothing has been measured yet, so only the floor is in play.
        expect(runHosts()).toHaveLength(2);

        layoutAt(scrollerHost(), 1000);
        layoutAt(runHosts()[0]!, 100);

        // The drift can only reach its own wrap point if the content is one run
        // wider than the frame, plus a margin run.
        const expected = Math.ceil((100 + 1000) / 100) + 1;
        expect(expected).toBe(12);
        expect(runHosts()).toHaveLength(expected);
    });

    it('filters by theme when a word is pressed', () => {
        const onThemePress = jest.fn();
        render(<ThemeDriftStrip themes={THEMES} onThemePress={onThemePress} />);
        fireEvent.press(screen.getAllByLabelText('Filter memory by calm')[0]!);
        expect(onThemePress).toHaveBeenCalledWith('calm');
    });

    it('labels the group for assistive tech', () => {
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        expect(screen.getByLabelText('Themes you return to')).toBeTruthy();
    });

    it('renders nothing when there are no themes', () => {
        const { toJSON } = render(<ThemeDriftStrip themes={[]} onThemePress={jest.fn()} />);
        expect(toJSON()).toBeNull();
    });

    it('keeps the strip from collapsing its words into one accessibility element', () => {
        // An `accessible` container groups every descendant into a single a11y
        // element, so the three theme buttons stop being reachable on their own.
        // Jest cannot see the platform a11y tree — RNTL still reports all three
        // buttons under a broken parent — so pin the prop that decides it.
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        expect(screen.getByTestId('theme-drift-strip').props.accessible).toBeFalsy();
    });

    it('separates the words with the prototype dot', () => {
        // The separator is part of the periodic content: it is what makes one
        // run's width equal the wrap distance and keeps the seam from reading as
        // two words colliding. Dropping it is invisible to every other assertion.
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        // It is decorative, so it is `aria-hidden` and out of the default query
        // set — ask for it explicitly.
        const dots = screen.getAllByText('·', { includeHiddenElements: true });
        expect(dots.length).toBeGreaterThanOrEqual(THEMES.length);
        // Jest cannot see the platform a11y tree, and the two props cover
        // different platforms: `aria-hidden` reaches web and RNTL, while
        // `accessible` is the one that stops iOS VoiceOver reading the dot
        // between every word. Pin both.
        expect(dots.every((dot) => dot.props.accessible === false)).toBe(true);
    });
});
