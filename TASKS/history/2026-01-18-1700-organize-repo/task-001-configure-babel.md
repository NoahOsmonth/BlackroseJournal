# Task: Configure Babel for NativeWind
 
## Problem
`babel.config.js` is missing. NativeWind requires a Babel plugin to process styles. Without it, styles won't be applied correctly.
 
## Proposed Fix
1.  Create `babel.config.js` in the root directory.
2.  Add `presets: ['babel-preset-expo']` and `plugins: ['nativewind/babel']`.
 
## Verification
- File exists and contains the correct configuration.
