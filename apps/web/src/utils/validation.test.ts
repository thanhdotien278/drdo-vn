import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidVnPhone } from './validation';

test('isValidVnPhone accepts Vietnamese mobile formats', () => {
  assert.equal(isValidVnPhone('0985835566'), true);
  assert.equal(isValidVnPhone('0985 835 566'), true);
  assert.equal(isValidVnPhone('0985-835-566'), true);
  assert.equal(isValidVnPhone('+84985835566'), true);
  assert.equal(isValidVnPhone('84985835566'), true);
  assert.equal(isValidVnPhone('  0985835566  '), true);
});

test('isValidVnPhone treats empty input as valid (optional field)', () => {
  assert.equal(isValidVnPhone(''), true);
  assert.equal(isValidVnPhone('   '), true);
});

test('isValidVnPhone rejects clearly invalid values', () => {
  assert.equal(isValidVnPhone('abc'), false);
  assert.equal(isValidVnPhone('123'), false);
  assert.equal(isValidVnPhone('0985!!'), false);
  assert.equal(isValidVnPhone('0000000000'), false);
  assert.equal(isValidVnPhone('+84000000000'), false);
  assert.equal(isValidVnPhone('99999999999999999999'), false);
});
