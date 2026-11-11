const { withInfoPlist, withPodfile, withPodfileProperties, withXcodeProject } = require('expo/config-plugins');

// The TV fork must build RN from source on both platforms. Expo's precompiled
// React Native artifacts are for the upstream phone build.
module.exports = function withAppleBuild(config, { isTV }) {
  config = withPodfileProperties(config, (mod) => {
    mod.modResults['ios.deploymentTarget'] = '17.0';
    mod.modResults['ios.buildReactNativeFromSource'] = 'true';
    mod.modResults.EXPO_USE_PRECOMPILED_MODULES = 'false';
    return mod;
  });
  config = withPodfile(config, (mod) => {
    mod.modResults.contents = [
      "ENV['RCT_USE_PREBUILT_RNCORE'] = '0'",
      "ENV['RCT_USE_RN_DEP'] = '0'",
      mod.modResults.contents,
    ].join('\n');
    return mod;
  });
  if (isTV) config = withInfoPlist(config, (mod) => {
    mod.modResults.UIAppSupportsHDR = true;
    delete mod.modResults.LSRequiresIPhoneOS;
    delete mod.modResults.UISupportedInterfaceOrientations;
    delete mod.modResults['UISupportedInterfaceOrientations~ipad'];
    return mod;
  });
  return withXcodeProject(config, (mod) => {
    for (const configuration of Object.values(mod.modResults.pbxXCBuildConfigurationSection())) {
      const settings = configuration.buildSettings;
      if (!settings) continue;
      if (!isTV) {
        settings.IPHONEOS_DEPLOYMENT_TARGET = '17.0';
        continue;
      }
      delete settings.IPHONEOS_DEPLOYMENT_TARGET;
      settings.SUPPORTED_PLATFORMS = '"appletvos appletvsimulator"';
      settings.SUPPORTS_MACCATALYST = 'NO';
    }
    return mod;
  });
};
