const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePixKey,
  validatePixForm,
  buildPixPayload,
} = require('../script.js');

test('normalizePixKey normalizes CPF to digits only', () => {
  const result = normalizePixKey('cpf', '529.982.247-25');
  assert.equal(result, '52998224725');
});

test('normalizePixKey normalizes CNPJ to digits only', () => {
  assert.equal(normalizePixKey('cnpj', '12.345.678/0001-90'), '12345678000190');
});

test('normalizePixKey trims email', () => {
  assert.equal(normalizePixKey('email', '  pix@empresa.com.br  '), 'pix@empresa.com.br');
});

test('normalizePixKey normalizes phone keeping leading plus', () => {
  assert.equal(normalizePixKey('phone', '+55 (11) 99876-5432'), '+5511998765432');
});

test('validatePixForm rejects invalid CPF length', () => {
  const result = validatePixForm({
    pixKeyType: 'cpf',
    pixKey: '123',
    amount: 0,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /CPF/);
});

test('validatePixForm rejects invalid email format', () => {
  const result = validatePixForm({
    pixKeyType: 'email',
    pixKey: 'email-invalido',
    amount: 0,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /E-mail/);
});

test('validatePixForm accepts valid Brazilian phone with country code', () => {
  const result = validatePixForm({
    pixKeyType: 'phone',
    pixKey: '+55 (11) 99876-5432',
    amount: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.normalizedKey, '+5511998765432');
});

test('validatePixForm rejects empty random key', () => {
  const result = validatePixForm({
    pixKeyType: 'random',
    pixKey: '   ',
    amount: 0,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /aleatoria/i);
});

test('buildPixPayload generates payload for CPF key', () => {
  const payload = buildPixPayload({
    pixKeyType: 'cpf',
    pixKey: '529.982.247-25',
    amount: 10.5,
  });

  assert.match(payload, /BR\.GOV\.BCB\.PIX/);
  assert.match(payload, /52998224725/);
  assert.match(payload, /540510\.50/);
  assert.match(payload, /5901N/);
  assert.match(payload, /6001C/);
});

test('buildPixPayload generates payload for CNPJ key', () => {
  const payload = buildPixPayload({
    pixKeyType: 'cnpj',
    pixKey: '12.345.678/0001-90',
    amount: 0,
  });

  assert.match(payload, /12345678000190/);
});

test('buildPixPayload generates payload for email key', () => {
  const payload = buildPixPayload({
    pixKeyType: 'email',
    pixKey: ' pix@empresa.com.br ',
    amount: 0,
  });

  assert.match(payload, /pix@empresa\.com\.br/);
});

test('buildPixPayload generates payload for phone key', () => {
  const payload = buildPixPayload({
    pixKeyType: 'phone',
    pixKey: '+55 (11) 99876-5432',
    amount: 0,
  });

  assert.match(payload, /\+5511998765432/);
});

test('buildPixPayload generates payload for random key without amount', () => {
  const payload = buildPixPayload({
    pixKeyType: 'random',
    pixKey: '123e4567-e89b-12d3-a456-426614174000',
    amount: 0,
  });

  assert.match(payload, /123e4567-e89b-12d3-a456-426614174000/);
  assert.doesNotMatch(payload, /54\d{2}/);
});

test('buildPixPayload uses custom identifier when provided', () => {
  const payload = buildPixPayload({
    pixKeyType: 'cnpj',
    pixKey: '01.487.734/0001-01',
    identifier: 'PGTOLOJA123',
    amount: 1680,
  });

  assert.match(payload, /62150511PGTOLOJA123/);
  assert.match(payload, /54071680\.00/);
});

test('buildPixPayload formats CRC field as 6304 followed by 4 hex characters', () => {
  const payload = buildPixPayload({
    pixKeyType: 'cnpj',
    pixKey: '01.487.734/0001-01',
    amount: 1680,
  });

  assert.match(payload, /6304[0-9A-F]{4}$/);
  assert.doesNotMatch(payload, /630204/);
});
