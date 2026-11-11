const isTV = process.env.EXPO_TV === '1';

module.exports = {
  expo: {
    name: 'WebGPU Apple HDR',
    slug: 'webgpu-apple-hdr',
    version: '1.0.0',
    platforms: ['ios'],
    orientation: 'default',
    userInterfaceStyle: 'dark',
    icon: './assets/icon.png',
    ios: {
      bundleIdentifier: 'dev.webgpu.applehdr',
      supportsTablet: true,
    },
    plugins: [
      ...(isTV ? [['@react-native-tvos/config-tv', {
        isTV: true,
        tvosDeploymentTarget: '17.0',
        appleTVImages: {
          iconSmall: './assets/tv/icon-small.png',
          iconSmall2x: './assets/tv/icon-small@2x.png',
          icon: './assets/tv/icon.png',
          topShelf: './assets/tv/top-shelf.png',
          topShelf2x: './assets/tv/top-shelf@2x.png',
          topShelfWide: './assets/tv/top-shelf-wide.png',
          topShelfWide2x: './assets/tv/top-shelf-wide@2x.png',
        },
      }]] : []),
      ['./plugins/withAppleBuild', { isTV }],
    ],
  },
};
