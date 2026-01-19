import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'hooks', 'services', 'constants', 'features'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const SAFE_AREA_IMPORT_PATTERN =
    /import\s+\{[^}]*\bSafeAreaView\b[^}]*\}\s+from\s+['"]react-native['"]/;
const SAFE_AREA_REQUIRE_PATTERN = /require\(['"]react-native['"]\)\.SafeAreaView/;

const collectSourceFiles = (directory: string): string[] => {
    if (!fs.existsSync(directory)) {
        return [];
    }

    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            return collectSourceFiles(fullPath);
        }

        if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
            return [];
        }

        return [fullPath];
    });
};

const findInvalidImports = (): string[] => {
    const files = SOURCE_DIRS.flatMap(dir => collectSourceFiles(path.join(PROJECT_ROOT, dir)));

    return files.filter(filePath => {
        const contents = fs.readFileSync(filePath, 'utf8');
        return SAFE_AREA_IMPORT_PATTERN.test(contents) || SAFE_AREA_REQUIRE_PATTERN.test(contents);
    });
};

describe('SafeAreaView imports', () => {
    it('does not import SafeAreaView from react-native', () => {
        const offenders = findInvalidImports();
        expect(offenders).toEqual([]);
    });
});
