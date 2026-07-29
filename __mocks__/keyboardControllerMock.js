const React = require('react');
const { View } = require('react-native');

const PassthroughView = ({ children, ...props }) => React.createElement(View, props, children);

module.exports = {
  KeyboardProvider: PassthroughView,
  KeyboardAvoidingView: PassthroughView,
};

