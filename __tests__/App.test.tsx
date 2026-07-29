/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('../src/context/SocketContext', () => {
  const ReactModule = require('react');
  return {
    SocketProvider: ({ children }) => ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

jest.mock('../src/calling/CallContext', () => {
  const ReactModule = require('react');
  return {
    CallProvider: ({ children }) => ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

jest.mock('../src/calling/CallOverlay', () => () => null);
jest.mock('../src/navigation/AppNavigator', () => () => null);
jest.mock('../src/i18n', () => ({
  __esModule: true,
  default: {
    resolvedLanguage: 'en',
    on: jest.fn(),
    off: jest.fn(),
  },
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
