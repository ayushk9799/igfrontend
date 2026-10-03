const React = require('react');
const { ScrollView, View } = require('react-native');

const PassthroughView = ({ children, ...props }) => React.createElement(View, props, children);

module.exports = {
  KeyboardProvider: PassthroughView,
  KeyboardAvoidingView: PassthroughView,
  KeyboardAwareScrollView: ScrollView,
  KeyboardStickyView: PassthroughView,
};
