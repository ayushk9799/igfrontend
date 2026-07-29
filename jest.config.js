module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/node_modules/react-native-gesture-handler/jestSetup.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': '<rootDir>/node_modules/react-native/jest/assetFileTransformer.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|react-native-gesture-handler|react-native-reanimated|react-native-worklets|@gorhom/bottom-sheet|@react-native(-community)?|react-redux|@reduxjs|redux|immer|reselect)/)',
  ],
  moduleNameMapper: {
    '\\.lottie$': '<rootDir>/__mocks__/lottieMock.js',
    '^@gorhom/bottom-sheet$': '<rootDir>/node_modules/@gorhom/bottom-sheet/mock.js',
    '^react-native-keyboard-controller$': '<rootDir>/__mocks__/keyboardControllerMock.js',
  },
};
