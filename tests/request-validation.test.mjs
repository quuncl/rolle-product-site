import test from 'node:test';
import assert from 'node:assert/strict';
import { validateName, validateContact } from '../assets/request-validation.js';

test('both fields are optional, including whitespace-only values', () => {
  for (const validate of [validateName, validateContact]) {
    assert.deepEqual(validate(''), {value:'', error:''});
    assert.deepEqual(validate('   '), {value:'', error:''});
  }
});

test('accepts names across languages and normalizes pasted spacing', () => {
  for (const name of ['Иван', 'Анна-Мария', 'O’Neill', 'Jean Luc', '李', 'И. Иванов']) {
    assert.equal(validateName(name).error, '', name);
  }
  assert.equal(validateName('  Анна   Мария  ').value, 'Анна Мария');
  assert.equal(validateName('Jose\u0301').value, 'José');
});

test('rejects non-name text and content that could create extra lines in the request', () => {
  for (const name of ['123', '---', '<script>', 'Иван123', 'Иван\nКонтакт: test', 'Иван\u0000', 'А'.repeat(81)]) {
    assert.ok(validateName(name).error, name);
  }
});

test('accepts common email addresses, subdomains, and international domains', () => {
  for (const email of ['name@example.com', 'hello+packaging@shop.example.co.uk', 'brand@пример.рф', 'name@xn--e1afmkfd.xn--p1ai']) {
    assert.equal(validateContact(email).error, '', email);
  }
  assert.equal(validateContact(' name@example.com ').value, 'name@example.com');
});

test('rejects malformed email addresses and excessive contact length', () => {
  for (const email of ['name@', '@example.com', 'a..b@example.com', '.name@example.com', 'a@@example.com', 'a@-example.com', 'a@example..com', 'a@example.123', 'name @example.com', 'a\n@example.com', 'a'.repeat(121)]) {
    assert.ok(validateContact(email).error, email);
  }
});

test('accepts formatted national/international phone numbers without changing them', () => {
  for (const phone of ['+7 (999) 123-45-67', '8 999 123 45 67', '+44 20 7946 0958', '1234567', '+123456789012345']) {
    assert.deepEqual(validateContact(phone), {value:phone, error:''});
  }
});

test('rejects incomplete numbers, misplaced plus signs, and unmatched parentheses', () => {
  for (const phone of ['123456', '+1234567890123456', '7+9991234567', '++79991234567', '+0 1234567', '(9991234567', '999)1234567', '+7 ((999)) 1234567', 'позвоните завтра']) {
    assert.ok(validateContact(phone).error, phone);
  }
});
