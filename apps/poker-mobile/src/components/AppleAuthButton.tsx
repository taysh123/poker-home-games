import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { radii } from '../theme/radii';

type Props = {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The OFFICIAL Apple sign-in button (review-safe per Apple HIG) — dumb, like GoogleAuthButton:
 * the flow lives in useAppleAuth. WHITE_OUTLINE matches the quiet outlined look of the Google
 * button on the navy background; height/radius match the auth-card form controls. iOS-only —
 * render it only when useAppleAuth reports `available`.
 */
export default function AppleAuthButton({ onPress, disabled, style }: Props) {
  return (
    <View
      style={[disabled && styles.disabled, style]}
      pointerEvents={disabled ? 'none' : 'auto'}
      accessibilityElementsHidden={false}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
        cornerRadius={radii.control}
        onPress={onPress}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    // Matches GoogleAuthButton/AppTextInput's 52px control height.
    height: 52,
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
});
