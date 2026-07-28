import { SUPPORT_EMAIL, supportMailto } from '../support';

describe('support contact', () => {
  it('exposes the single support address', () => {
    expect(SUPPORT_EMAIL).toBe('truestorylabs@gmail.com');
  });

  it('builds a mailto with an encoded subject', () => {
    expect(supportMailto('T Poker support')).toBe(
      'mailto:truestorylabs@gmail.com?subject=T%20Poker%20support',
    );
  });

  it('appends an encoded body when given one', () => {
    expect(supportMailto('Feedback', 'Line one')).toBe(
      'mailto:truestorylabs@gmail.com?subject=Feedback&body=Line%20one',
    );
  });

  it('encodes characters that would otherwise break the URL', () => {
    expect(supportMailto('a&b=c')).toBe('mailto:truestorylabs@gmail.com?subject=a%26b%3Dc');
  });

  it('omits the body param entirely when the body is empty', () => {
    expect(supportMailto('Subject', '')).toBe('mailto:truestorylabs@gmail.com?subject=Subject');
  });
});
