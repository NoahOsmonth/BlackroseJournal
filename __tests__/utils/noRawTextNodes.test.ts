import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET_DIRS = ['app', 'components'];
const ALLOWED_TEXT_PARENTS = new Set(['Text', 'ThemedText']);

function collectTsxFiles(dir: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach((entry) => {
        if (entry.name.startsWith('.')) {
            return;
        }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') {
                return;
            }
            collectTsxFiles(fullPath, files);
            return;
        }

        if (entry.isFile() && fullPath.endsWith('.tsx')) {
            files.push(fullPath);
        }
    });

    return files;
}

function getTagName(name?: ts.JsxTagNameExpression): string {
    if (!name) {
        return '';
    }
    if (ts.isIdentifier(name)) {
        return name.text;
    }

    if (ts.isPropertyAccessExpression(name)) {
        return name.name.text;
    }

    return '';
}

function reportRawText(
    sourceFile: ts.SourceFile,
    node: ts.Node,
    isTextContext: boolean
): string | null {
    if (isTextContext) {
        return null;
    }

    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const relativePath = path.relative(ROOT, sourceFile.fileName);
    return `${relativePath}:${line + 1}:${character + 1}`;
}

function scanSourceFile(filePath: string): string[] {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const violations: string[] = [];

    const visit = (node: ts.Node, isTextContext: boolean) => {
        if (ts.isJsxElement(node)) {
            const name = getTagName(node.openingElement.name);
            const nextIsTextContext = isTextContext || ALLOWED_TEXT_PARENTS.has(name);
            node.children.forEach((child) => visit(child, nextIsTextContext));
            return;
        }

        if (ts.isJsxFragment(node)) {
            node.children.forEach((child) => visit(child, isTextContext));
            return;
        }

        if (ts.isJsxText(node)) {
            const raw = node.getText(sourceFile).trim();
            if (raw === '.') {
                const violation = reportRawText(sourceFile, node, isTextContext);
                if (violation) {
                    violations.push(violation);
                }
            }
            return;
        }

        if (ts.isJsxExpression(node) && node.expression) {
            const expr = node.expression;
            if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
                const raw = expr.text.trim();
                if (raw === '.') {
                    const violation = reportRawText(sourceFile, node, isTextContext);
                    if (violation) {
                        violations.push(violation);
                    }
                }
            }
            return;
        }

        ts.forEachChild(node, (child) => visit(child, isTextContext));
    };

    visit(sourceFile, false);
    return violations;
}

describe('No raw dot text nodes in View/Pressable trees', () => {
    it('does not render stray "." text nodes outside Text', () => {
        const files = TARGET_DIRS
            .map((dir) => path.join(ROOT, dir))
            .flatMap((dir) => collectTsxFiles(dir));

        const violations = files.flatMap((file) => scanSourceFile(file));

        expect(violations).toEqual([]);
    });
});
