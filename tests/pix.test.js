const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePixKey,
  validatePixForm,
  buildPixPayload,
  buildQrCodeFilename,
  wrapPixKeyForExport,
  getPixKeyDisplayValue,
  getExportCardHeight,
  getPixKeyTypeLabel,
  formatAmountForExport,
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

test('buildQrCodeFilename creates a png filename from identifier', () => {
  const filename = buildQrCodeFilename('Pedido Loja 123');

  assert.equal(filename, 'pix-qrcode-pedido-loja-123.png');
});

test('wrapPixKeyForExport splits long pix key into readable lines', () => {
  const lines = wrapPixKeyForExport('1234567890123456789012345678901234567890', 12);

  assert.deepEqual(lines, [
    '123456789012',
    '345678901234',
    '567890123456',
    '7890',
  ]);
});

test('getPixKeyDisplayValue returns normalized pix key instead of payload', () => {
  const value = getPixKeyDisplayValue({
    pixKeyType: 'phone',
    pixKey: '+55 (11) 99876-5432',
  });

  assert.equal(value, '+5511998765432');
});

test('getExportCardHeight reserves space for title, key lines and bottom padding', () => {
  const height = getExportCardHeight(4);

  assert.equal(height, 782);
});

test('getPixKeyTypeLabel returns display label for selected key type', () => {
  assert.equal(getPixKeyTypeLabel('phone'), 'Telefone');
});

test('formatAmountForExport returns formatted amount only when positive', () => {
  assert.equal(formatAmountForExport(19.9), 'Valor: R$ 19.90');
  assert.equal(formatAmountForExport(0), '');
});
