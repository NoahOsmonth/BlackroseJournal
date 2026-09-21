const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * The chat provider is a plain-HTTP gateway on a private network, and the app
 * also lets the user point Settings at their own HTTP base URL. Android blocks
 * cleartext by default from targetSdk 28 on, which is why debug builds work
 * (the template's debug manifest sets this flag) and release builds cannot
 * reach the provider. Set it on the release manifest too.
 */
module.exports = function withCleartextTraffic(config) {
    return withAndroidManifest(config, (cfg) => {
        const application = cfg.modResults.manifest.application;
        if (Array.isArray(application) && application[0]) {
            application[0].$['android:usesCleartextTraffic'] = 'true';
        }
        return cfg;
    });
};
