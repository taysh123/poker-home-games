import { alertLabel, invitationsAlertCopy, settlementsAlertCopy } from '../homeAlerts';

/**
 * Literals, not values rebuilt from formatMoney — a test that calls the code it guards moves with
 * it. Currency is the module default (ILS).
 */
const owesMe = { payerUserId: 'other', receiverUserId: 'me', amount: 120 };
const iOwe = { payerUserId: 'me', receiverUserId: 'other', amount: 45 };

describe('settlementsAlertCopy — the money phrasing is the announcement', () => {
  it('pluralises the count', () => {
    expect(settlementsAlertCopy([iOwe], 'me').title).toBe('1 pending settlement');
    expect(settlementsAlertCopy([iOwe, owesMe], 'me').title).toBe('2 pending settlements');
  });

  it('states what the caller owes', () => {
    expect(settlementsAlertCopy([iOwe], 'me').sub).toBe('You owe ₪45');
  });

  it('states what the caller is owed', () => {
    expect(settlementsAlertCopy([owesMe], 'me').sub).toBe("You're owed ₪120");
  });

  it('states both directions when both apply', () => {
    expect(settlementsAlertCopy([iOwe, owesMe], 'me').sub).toBe('You owe ₪45 · Owed ₪120');
  });

  it('falls back to an instruction when the caller is in neither side', () => {
    // A settlement between two OTHER people: announcing "You owe ₪0" would be a lie.
    expect(settlementsAlertCopy([{ payerUserId: 'a', receiverUserId: 'b', amount: 90 }], 'me').sub)
      .toBe('Tap to view and settle up');
  });

  it('does not attribute anything to an unknown caller', () => {
    expect(settlementsAlertCopy([iOwe, owesMe], undefined).sub).toBe('Tap to view and settle up');
  });
});

describe('invitationsAlertCopy', () => {
  it('pluralises the count', () => {
    expect(invitationsAlertCopy(1).title).toBe('1 group invitation');
    expect(invitationsAlertCopy(3).title).toBe('3 group invitations');
  });
});

describe('alertLabel — the banner is one element, so the name carries both lines', () => {
  it('reads the title then the subtitle', () => {
    expect(alertLabel(settlementsAlertCopy([iOwe], 'me'))).toBe('1 pending settlement. You owe ₪45');
    expect(alertLabel(invitationsAlertCopy(2))).toBe('2 group invitations. Tap to view and respond');
  });
});
