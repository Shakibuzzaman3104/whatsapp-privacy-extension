/**
 * @author Shakib
 * @since 25/10/26
 */
import { describe, expect, it } from 'vitest';
import { classify, luhnValid } from '../src/lib/classify';

const kinds = (text: string) => classify(text).kinds;

describe('classify', () => {
  it('leaves ordinary chat alone', () => {
    for (const text of [
      'see you at 7?',
      'lol that was hilarious',
      'I will be there in 10 minutes',
      'Meeting moved to room 4012',
      'Happy birthday 🎉',
      'Order of 3 pizzas please',
      'It happened in 2019',
    ]) {
      expect(classify(text).sensitive, text).toBe(false);
    }
  });

  it('flags one-time codes only next to a code keyword', () => {
    expect(kinds('Your verification code is 482913')).toContain('otp');
    expect(kinds('482913 is your Facebook confirmation code')).toContain('otp');
    expect(kinds('G-482913 is your Google verification code.')).toContain('otp');
    expect(kinds('আপনার ওটিপি কোড 4829')).toContain('otp');
    expect(kinds('Use OTP 5521 to login. Do not share it')).toContain('otp');
    expect(kinds('the bus number is 482913')).not.toContain('otp');
  });

  it('flags card numbers that pass the Luhn check', () => {
    expect(kinds('card 4111 1111 1111 1111 exp 12/29')).toContain('card');
    expect(kinds('5500-0000-0000-0004')).toContain('card');
    expect(kinds('tracking 4111 1111 1111 1112')).not.toContain('card');
  });

  it('flags IBANs and bank accounts', () => {
    expect(kinds('IBAN: DE89 3704 0044 0532 0130 00')).toContain('bank');
    expect(kinds('A/C no 1501202345678 Dutch Bangla')).toContain('bank');
    expect(kinds('account number: 0123456789012')).toContain('bank');
  });

  it('flags passwords and PINs', () => {
    expect(kinds('wifi password is sunflower22')).toContain('password');
    expect(kinds('Also, the wifi password at the flat is sunflower22')).toContain('password');
    expect(kinds('the PIN for the gate is 7781')).toContain('password');
    expect(kinds('password reset was easy')).not.toContain('password');
    expect(kinds('pass: hunter2')).toContain('password');
    expect(kinds('my pin is 4321')).toContain('password');
    expect(kinds('পাসওয়ার্ড abc123')).toContain('password');
    expect(kinds('I passed the exam')).not.toContain('password');
  });

  it('flags phone numbers and emails', () => {
    expect(kinds('call me on +880 1712-345678')).toContain('phone');
    expect(kinds('01712345678')).toContain('phone');
    expect(kinds('(415) 555-2671')).toContain('phone');
    expect(kinds('mail me at rahim.ahmed@example.com')).toContain('email');
  });

  it('flags money and mobile-banking transactions', () => {
    expect(kinds('You have received Tk 5,000.00 from 01712345678. TrxID 9JK3L2M1N0')).toContain('money');
    expect(kinds('Cash In Tk 1,200 successful. Balance Tk 3,450.50')).toContain('money');
    expect(kinds('Your a/c debited by BDT 12,500')).toContain('money');
    expect(kinds('sent you $250 for rent')).toContain('money');
    expect(kinds('৳৫০০ পাঠিয়েছি')).toContain('money');
  });

  it('flags street addresses', () => {
    expect(kinds('House 12, Road 5, Dhanmondi, Dhaka')).toContain('address');
    expect(kinds('221B Baker Street, London')).toContain('address');
    expect(kinds('flat 4B, 32 Gulshan Avenue')).toContain('address');
  });

  it('respects the enabled kinds', () => {
    const r = classify('Your verification code is 482913', { otp: false });
    expect(r.sensitive).toBe(false);
  });
});

describe('luhnValid', () => {
  it('validates known numbers', () => {
    expect(luhnValid('4111111111111111')).toBe(true);
    expect(luhnValid('4111111111111112')).toBe(false);
  });
});
