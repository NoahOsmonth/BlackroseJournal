/**
 * Markdown Styles Configuration
 * Defines styles for react-native-marked matching app theme
 * Supports light and dark mode with Plus Jakarta Sans-compatible sizing
 */

import type { MarkedStyles } from 'react-native-marked';
import { StyleSheet } from 'react-native';

// Colors matching the app theme
const colors = {
    light: {
        text: '#111827',
        heading: '#111827',
        link: '#FF9F0A',
        code: '#F3F4F6',
        codeText: '#1F2937',
        blockquoteBg: '#F2F2F7',
        blockquoteBorder: '#FF9F0A',
    },
    dark: {
        text: '#F9FAFB',
        heading: '#F9FAFB',
        link: '#FFB340',
        code: '#1C1C1E',
        codeText: '#F9FAFB',
        blockquoteBg: '#1C1C1E',
        blockquoteBorder: '#FFB340',
    },
};

type MarkdownFontWeight = '400' | '500' | '600' | '700';

interface MarkdownStyleOptions {
    fontWeight?: MarkdownFontWeight;
    color?: string;
    headingColor?: string;
    linkColor?: string;
    fontSize?: number;
    fontStyle?: 'normal' | 'italic';
}

/**
 * Get markdown styles for the specified color scheme
 */
export function getMarkdownStyles(
    isDark: boolean,
    options: MarkdownStyleOptions = {}
): MarkedStyles {
    const palette = isDark ? colors.dark : colors.light;
    const bodyFontWeight = options.fontWeight ?? '400';
    const bodyColor = options.color ?? palette.text;
    const headingColor = options.headingColor ?? palette.heading;
    const linkColor = options.linkColor ?? palette.link;
    const bodyFontSize = options.fontSize ?? 15;
    const bodyFontStyle = options.fontStyle ?? 'normal';

    return StyleSheet.create<MarkedStyles>({
        text: {
            color: bodyColor,
            fontSize: bodyFontSize,
            lineHeight: 22,
            fontWeight: bodyFontWeight,
            fontStyle: bodyFontStyle,
        },
        paragraph: {
            paddingVertical: 4,
        },
        h1: {
            color: headingColor,
            fontSize: 28,
            fontWeight: '700',
            marginBottom: 12,
            marginTop: 16,
            lineHeight: 34,
        },
        h2: {
            color: headingColor,
            fontSize: 24,
            fontWeight: '700',
            marginBottom: 10,
            marginTop: 14,
            lineHeight: 30,
        },
        h3: {
            color: headingColor,
            fontSize: 20,
            fontWeight: '600',
            marginBottom: 8,
            marginTop: 12,
            lineHeight: 26,
        },
        h4: {
            color: headingColor,
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 6,
            marginTop: 10,
            lineHeight: 24,
        },
        h5: {
            color: headingColor,
            fontSize: 16,
            fontWeight: '700',
            marginBottom: 4,
            marginTop: 8,
            lineHeight: 22,
        },
        h6: {
            color: headingColor,
            fontSize: 14,
            fontWeight: '700',
            marginBottom: 4,
            marginTop: 6,
            lineHeight: 20,
        },
        strong: {
            fontWeight: '700',
        },
        em: {
            fontStyle: 'italic',
        },
        strikethrough: {
            textDecorationLine: 'line-through',
        },
        link: {
            color: linkColor,
            textDecorationLine: 'underline',
        },
        list: {
            marginLeft: 8,
            marginVertical: 4,
        },
        li: {
            color: bodyColor,
            fontSize: bodyFontSize,
            lineHeight: 22,
            fontWeight: bodyFontWeight,
            fontStyle: bodyFontStyle,
            marginVertical: 2,
        },
        codespan: {
            backgroundColor: palette.code,
            color: palette.codeText,
            fontFamily: 'monospace',
            fontSize: 14,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
        },
        code: {
            backgroundColor: palette.code,
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
        },
        blockquote: {
            backgroundColor: palette.blockquoteBg,
            borderLeftWidth: 4,
            borderLeftColor: palette.blockquoteBorder,
            paddingLeft: 12,
            paddingVertical: 8,
            marginVertical: 8,
        },
        hr: {
            backgroundColor: isDark ? '#2C2C2E' : '#E5E7EB',
            height: 1,
            marginVertical: 16,
        },
        table: {
            borderWidth: 1,
            borderColor: isDark ? '#2C2C2E' : '#E5E7EB',
        },
        tableRow: {
            flexDirection: 'row',
        },
        tableCell: {
            padding: 8,
        },
    });
}
