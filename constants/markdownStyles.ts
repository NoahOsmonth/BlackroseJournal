/**
 * Markdown Styles Configuration
 * Defines styles for react-native-markdown-display matching app theme
 * Supports light and dark mode with Inter-compatible sizing
 */

import { StyleSheet } from 'react-native';

// Colors matching the app theme
const colors = {
    light: {
        text: '#1C1C1E',
        heading: '#1C1C1E',
        link: '#E91E63',
        code: '#e8e8ec',
        codeText: '#2C3E50',
        blockquoteBg: '#F5F5F7',
        blockquoteBorder: '#E91E63',
    },
    dark: {
        text: '#E5E5E7',
        heading: '#E5E5E7',
        link: '#F48FB1',
        code: '#2C2C2E',
        codeText: '#E5E5E7',
        blockquoteBg: '#1E1E1E',
        blockquoteBorder: '#E91E63',
    },
};

type MarkdownFontWeight = '400' | '500' | '600' | '700';

interface MarkdownStyleOptions {
    fontWeight?: MarkdownFontWeight;
}

/**
 * Get markdown styles for the specified color scheme
 */
export function getMarkdownStyles(isDark: boolean, options: MarkdownStyleOptions = {}) {
    const palette = isDark ? colors.dark : colors.light;
    const bodyFontWeight = options.fontWeight ?? '400';

    return StyleSheet.create({
        // Body text
        body: {
            color: palette.text,
            fontSize: 15,
            lineHeight: 22,
            fontWeight: bodyFontWeight,
        },
        // Headers
        heading1: {
            color: palette.heading,
            fontSize: 28,
            fontWeight: '700',
            marginBottom: 12,
            marginTop: 16,
            lineHeight: 34,
        },
        heading2: {
            color: palette.heading,
            fontSize: 24,
            fontWeight: '700',
            marginBottom: 10,
            marginTop: 14,
            lineHeight: 30,
        },
        heading3: {
            color: palette.heading,
            fontSize: 20,
            fontWeight: '600',
            marginBottom: 8,
            marginTop: 12,
            lineHeight: 26,
        },
        heading4: {
            color: palette.heading,
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 6,
            marginTop: 10,
            lineHeight: 24,
        },
        heading5: {
            color: palette.heading,
            fontSize: 16,
            fontWeight: '700',
            marginBottom: 4,
            marginTop: 8,
            lineHeight: 22,
        },
        heading6: {
            color: palette.heading,
            fontSize: 14,
            fontWeight: '700',
            marginBottom: 4,
            marginTop: 6,
            lineHeight: 20,
        },
        // Text formatting
        strong: {
            fontWeight: '700',
        },
        em: {
            fontStyle: 'italic',
        },
        // Links
        link: {
            color: palette.link,
            textDecorationLine: 'underline',
        },
        // Lists
        bullet_list: {
            marginLeft: 8,
            marginVertical: 4,
        },
        ordered_list: {
            marginLeft: 8,
            marginVertical: 4,
        },
        list_item: {
            flexDirection: 'row',
            marginVertical: 2,
        },
        bullet_list_icon: {
            marginRight: 8,
            fontSize: 16,
        },
        ordered_list_icon: {
            marginRight: 8,
            fontSize: 14,
        },
        // Code
        code_inline: {
            backgroundColor: palette.code,
            color: palette.codeText,
            fontFamily: 'monospace',
            fontSize: 14,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
        },
        code_block: {
            backgroundColor: palette.code,
            color: palette.codeText,
            fontFamily: 'monospace',
            fontSize: 14,
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
        },
        fence: {
            backgroundColor: palette.code,
            color: palette.codeText,
            fontFamily: 'monospace',
            fontSize: 14,
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
        },
        // Blockquote
        blockquote: {
            backgroundColor: palette.blockquoteBg,
            borderLeftWidth: 4,
            borderLeftColor: palette.blockquoteBorder,
            paddingLeft: 12,
            paddingVertical: 8,
            marginVertical: 8,
        },
        // Paragraph
        paragraph: {
            marginVertical: 4,
            fontWeight: bodyFontWeight,
        },
        // Horizontal rule
        hr: {
            backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
            height: 1,
            marginVertical: 16,
        },
    });
}
