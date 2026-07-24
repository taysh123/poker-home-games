import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Share } from 'react-native';

// QR lib → surface the encoded value so we can assert the correct link is embedded.
jest.mock('react-native-qrcode-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: (props: any) => <View testID="invite-qr" accessibilityLabel={props.value} /> };
});
const mockCopy = jest.fn().mockResolvedValue(undefined);
jest.mock('../../utils/clipboard', () => ({ copyToClipboard: (t: string) => mockCopy(t) }));
const mockToast = jest.fn();
jest.mock('../../utils/toast', () => ({ showToast: (...a: any[]) => mockToast(...a) }));
jest.mock('../motion/PressableScale', () => {
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (p: any) => <Pressable {...p} /> };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: ({ children, ...r }: any) => <View {...r}>{children}</View> };
});
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: ({ name }: any) => <View testID={`icon-${name}`} /> };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import InviteSheet from '../InviteSheet';

const url = 'https://app.tpoker.app/join/group/tok123';

function renderSheet(props: Partial<React.ComponentProps<typeof InviteSheet>> = {}) {
  return render(
    <InviteSheet visible onClose={jest.fn()} kind="group" title="Friday Game" url={url} {...props} />,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('InviteSheet', () => {
  it('encodes the exact invite URL in the QR code', () => {
    renderSheet();
    expect(screen.getByTestId('invite-qr').props.accessibilityLabel).toBe(url);
  });

  it('Copy copies the URL and confirms with a success toast', async () => {
    renderSheet();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Copy invite link'));
    });
    expect(mockCopy).toHaveBeenCalledWith(url);
    expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/copied/i), 'success');
  });

  it('Share shares the kind-specific message together with the URL', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    renderSheet({ kind: 'session', title: 'Home Game' });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Share invite link'));
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ message: `Join my poker session "Home Game"!\n\n${url}`, url }),
    );
    spy.mockRestore();
  });

  it('shows an expiry line when an expiry is provided', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    renderSheet({ expiresAt: future });
    expect(screen.getByText(/Expires in/)).toBeTruthy();
  });
});
