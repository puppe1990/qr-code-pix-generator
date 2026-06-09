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
  getExportCommentBlockHeight,
  normalizePngComment,
  wrapPngCommentForExport,
  getPixKeyTypeLabel,
  formatAmountForExport,
  GRADIENT_PRESETS,
  normalizeHexColor,
  getGradientPreset,
  resolveExportGradient,
  getExportGradientStops,
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

test('getExportCardHeight adds space for comment lines when provided', () => {
  const height = getExportCardHeight(2, 2);

  assert.equal(height, 852);
});

test('normalizePngComment trims and collapses whitespace', () => {
  assert.equal(normalizePngComment('  Pagamento   do   pedido  '), 'Pagamento do pedido');
  assert.equal(normalizePngComment('   '), '');
});

test('wrapPngCommentForExport splits long comments into readable lines', () => {
  const lines = wrapPngCommentForExport('Pagamento referente ao pedido numero 123 da loja virtual', 20);

  assert.deepEqual(lines, [
    'Pagamento referente ',
    'ao pedido numero 123',
    ' da loja virtual',
  ]);
});

test('getExportCommentBlockHeight returns zero when there are no comment lines', () => {
  assert.equal(getExportCommentBlockHeight(0), 0);
  assert.equal(getExportCommentBlockHeight(), 0);
});

test('getPixKeyTypeLabel returns display label for selected key type', () => {
  assert.equal(getPixKeyTypeLabel('phone'), 'Telefone');
});

test('formatAmountForExport returns formatted amount only when positive', () => {
  assert.equal(formatAmountForExport(19.9), 'Valor: R$ 19.90');
  assert.equal(formatAmountForExport(0), '');
});

test('GRADIENT_PRESETS exposes named presets with three color stops', () => {
  assert.ok(GRADIENT_PRESETS.length >= 3);
  assert.ok(GRADIENT_PRESETS.some((preset) => preset.id === 'ocean'));
  GRADIENT_PRESETS
    .filter((preset) => preset.stops)
    .forEach((preset) => {
      assert.equal(preset.stops.length, 3);
      preset.stops.forEach((stop) => {
        assert.match(stop.color, /^#[0-9a-fA-F]{6}$/);
      });
    });
});

test('normalizeHexColor accepts shorthand and full hex with or without hash', () => {
  assert.equal(normalizeHexColor('#fff'), '#ffffff');
  assert.equal(normalizeHexColor('0F172A'), '#0f172a');
  assert.equal(normalizeHexColor('#082f49'), '#082f49');
});

test('normalizeHexColor rejects invalid hex values', () => {
  assert.equal(normalizeHexColor(''), null);
  assert.equal(normalizeHexColor('not-a-color'), null);
  assert.equal(normalizeHexColor('#12345'), null);
});

test('getGradientPreset returns preset by id and falls back to default', () => {
  const ocean = getGradientPreset('ocean');
  assert.equal(ocean.id, 'ocean');
  assert.deepEqual(ocean.stops[0], { position: 0, color: '#0f172a' });

  const fallback = getGradientPreset('unknown-id');
  assert.equal(fallback.id, 'ocean');
});

test('resolveExportGradient uses preset stops when preset id is provided', () => {
  const result = resolveExportGradient({ presetId: 'emerald' });

  assert.equal(result.ok, true);
  assert.equal(result.presetId, 'emerald');
  assert.equal(result.stops.length, 3);
});

test('resolveExportGradient builds custom stops from three hex colors', () => {
  const result = resolveExportGradient({
    presetId: 'custom',
    color1: '#111111',
    color2: '#222222',
    color3: '#333333',
  });

  assert.equal(result.ok, true);
  assert.equal(result.presetId, 'custom');
  assert.deepEqual(result.stops, [
    { position: 0, color: '#111111' },
    { position: 0.55, color: '#222222' },
    { position: 1, color: '#333333' },
  ]);
});

test('resolveExportGradient rejects custom mode with invalid hex', () => {
  const result = resolveExportGradient({
    presetId: 'custom',
    color1: '#111111',
    color2: 'not-a-color',
    color3: '#333333',
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /hex/i);
  assert.equal(result.field, 'gradientColor2');
});

test('getExportGradientStops returns stops for valid gradient config', () => {
  const stops = getExportGradientStops({
    presetId: 'sunset',
  });

  assert.equal(stops.length, 3);
  assert.equal(stops[0].position, 0);
  assert.match(stops[2].color, /^#[0-9A-F]{6}$/i);
});
