import React from 'react';

const TEXT_COMPONENTS = new Set(['Text', 'ThemedText']);
const VIEW_COMPONENTS = new Set([
    'View',
    'Pressable',
    'SafeAreaView',
    'TouchableOpacity',
    'TouchableHighlight',
    'TouchableWithoutFeedback',
]);

let isInstalled = false;
const warned = new Set<string>();
type CreateElementShim = (
    type: unknown,
    props: unknown,
    ...children: React.ReactNode[]
) => React.ReactElement;

function getTypeName(type: unknown): string {
    if (typeof type === 'string') {
        return type;
    }

    if (typeof type === 'function') {
        const namedType = type as { displayName?: string; name?: string };
        return namedType.displayName || namedType.name || '';
    }

    if (typeof type === 'object' && type) {
        const displayName = (type as { displayName?: string }).displayName;
        return displayName || '';
    }

    return '';
}

function isTextContext(typeName: string, parentIsText: boolean): boolean {
    return parentIsText || TEXT_COMPONENTS.has(typeName);
}

function findRawText(children: React.ReactNode, parentIsText: boolean): string | null {
    const array = React.Children.toArray(children);

    for (const child of array) {
        if (typeof child === 'string' || typeof child === 'number') {
            if (parentIsText) {
                continue;
            }

            const value = String(child).trim();
            if (value.length > 0) {
                return value;
            }
        }

        if (React.isValidElement(child)) {
            const typeName = getTypeName(child.type);
            const nextIsText = isTextContext(typeName, parentIsText);
            if (!nextIsText) {
                const props = child.props as { children?: React.ReactNode } | undefined;
                const nested = findRawText(props?.children, nextIsText);
                if (nested) {
                    return nested;
                }
            }
        }
    }

    return null;
}

function shouldSkipGuard(): boolean {
    if (typeof __DEV__ !== 'undefined') {
        return !__DEV__;
    }

    return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test';
}

export function installRawTextGuard(): void {
    if (isInstalled || shouldSkipGuard()) {
        return;
    }

    isInstalled = true;
    const originalCreateElement = React.createElement as unknown as CreateElementShim;
    const reactWithMutableCreateElement = React as unknown as {
        createElement: CreateElementShim;
    };

    reactWithMutableCreateElement.createElement = (type, props, ...children) => {
        const typeName = getTypeName(type);
        if (VIEW_COMPONENTS.has(typeName)) {
            const rawText = findRawText(children, false);
            if (rawText) {
                const key = `${typeName}:${rawText}`;
                if (!warned.has(key)) {
                    warned.add(key);
                    console.warn(
                        `Raw text node found inside <${typeName}>: "${rawText}". Wrap text in <Text>.`
                    );
                }
            }
        }

        return originalCreateElement(type, props, ...children);
    };
}
