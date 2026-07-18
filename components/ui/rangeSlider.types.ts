export interface RangeSliderProps {
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    /** Fired on release (and when drag is interrupted). Use this to persist. */
    readonly onChange: (value: number) => void;
    /** Fired while dragging so labels can update without persisting. */
    readonly onSliding?: (value: number) => void;
    readonly accessibilityLabel?: string;
    /** @deprecated Unused — paint is solid theme hex (kept for call-site compat). */
    readonly trackClassName?: string;
    /** @deprecated Unused — paint is solid theme hex (kept for call-site compat). */
    readonly fillClassName?: string;
    /** @deprecated Unused — paint is solid theme hex (kept for call-site compat). */
    readonly thumbClassName?: string;
}
