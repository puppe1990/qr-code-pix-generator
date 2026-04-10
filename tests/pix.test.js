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
    merchantName: 'Empresa Teste',
    merchantCity: 'Sao Paulo',
    amount: 0,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /CPF/);
});

test('validatePixForm rejects invalid email format', () => {
  const result = validatePixForm({
    pixKeyType: 'email',
    pixKey: 'email-invalido',
    merchantName: 'Empresa Teste',
    merchantCity: 'Sao Paulo',
    amount: 0,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /E-mail/);
});

test('validatePixForm accepts valid Brazilian phone with country code', () => {
  const result = validatePixForm({
    pixKeyType: 'phone',
    pixKey: '+55 (11) 99876-5432',
    merchantName: 'Empresa Teste',
    merchantCity: 'Sao Paulo',
    amount: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.normalizedKey, '+5511998765432');
});

test('validatePixForm rejects empty random key', () => {
  const result = validatePixForm({
    pixKeyType: 'random',
    pixKey: '   ',
    merchantName: 'Empresa Teste',
    merchantCity: 'Sao Paulo',
    amount: 0,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /aleatoria/i);
});

test('buildPixPayload generates payload for CPF key', () => {
  const payload = buildPixPayload({
    pixKeyType: 'cpf',
    pixKey: '529.982.247-25',
    merchantName: 'Loja Centro',
    merchantCity: 'Curitiba',
    amount: 10.5,
  });

  assert.match(payload, /br\.gov\.bcb\.pix/);
  assert.match(payload, /52998224725/);
  assert.match(payload, /540510\.50/);
});

test('buildPixPayload generates payload for CNPJ key', () => {
  const payload = buildPixPayload({
    pixKeyType: 'cnpj',
    pixKey: '12.345.678/0001-90',
    merchantName: 'Loja Centro',
    merchantCity: 'Curitiba',
    amount: 0,
  });

  assert.match(payload, /12345678000190/);
});

test('buildPixPayload generates payload for email key', () => {
  const payload = buildPixPayload({
    pixKeyType: 'email',
    pixKey: ' pix@empresa.com.br ',
    merchantName: 'Loja Centro',
    merchantCity: 'Curitiba',
    amount: 0,
  });

  assert.match(payload, /pix@empresa\.com\.br/);
});

test('buildPixPayload generates payload for phone key', () => {
  const payload = buildPixPayload({
    pixKeyType: 'phone',
    pixKey: '+55 (11) 99876-5432',
    merchantName: 'Loja Centro',
    merchantCity: 'Curitiba',
    amount: 0,
  });

  assert.match(payload, /\+5511998765432/);
});

test('buildPixPayload generates payload for random key without amount', () => {
  const payload = buildPixPayload({
    pixKeyType: 'random',
    pixKey: '123e4567-e89b-12d3-a456-426614174000',
    merchantName: 'Loja Centro',
    merchantCity: 'Curitiba',
    amount: 0,
  });

  assert.match(payload, /123e4567-e89b-12d3-a456-426614174000/);
  assert.doesNotMatch(payload, /54\d{2}/);
});
