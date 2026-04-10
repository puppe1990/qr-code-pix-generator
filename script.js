// Pix payload generator following EMV QR Code specification for Brazil
class PixPayload {
  constructor(pixKey, merchantName, merchantCity, amount, identifier) {
    this.pixKey = pixKey;
    this.merchantName = merchantName;
    this.merchantCity = merchantCity;
    this.amount = amount;
    this.identifier = identifier;
  }

  formatField(id, value) {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  }

  generate() {
    const payload = [
      this.formatField('00', '01'),
      this.formatField(
        '26',
        this.formatField('00', 'BR.GOV.BCB.PIX') +
          this.formatField('01', this.pixKey)
      ),
      this.formatField('52', '0000'),
      this.formatField('53', '986'),
      this.amount && this.amount > 0
        ? this.formatField('54', this.amount.toFixed(2))
        : null,
      this.formatField('58', 'BR'),
      this.formatField('59', sanitizeMerchantName(this.merchantName)),
      this.formatField('60', sanitizeMerchantCity(this.merchantCity)),
      this.formatField('62', this.formatField('05', this.identifier)),
    ].filter(Boolean);

    const payloadPartial = payload.join('');
    const crcField = this.formatField('63', '04');
    const payloadFull = payloadPartial + crcField;

    return payloadFull + this.crc16(payloadFull);
  }

  crc16(str) {
    let crc = 0xffff;

    for (let i = 0; i < str.length; i += 1) {
      crc ^= str.charCodeAt(i) << 8;

      for (let j = 0; j < 8; j += 1) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      }
    }

    return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  }
}

const PIX_KEY_CONFIG = {
  cpf: {
    label: 'CPF',
    placeholder: 'Informe o CPF',
    helper: '',
  },
  cnpj: {
    label: 'CNPJ',
    placeholder: 'Informe o CNPJ',
    helper: '',
  },
  email: {
    label: 'E-mail',
    placeholder: 'Informe o email',
    helper: '',
  },
  phone: {
    label: 'Telefone',
    placeholder: 'Informe o telefone com +55',
    helper: '',
  },
  random: {
    label: 'Aleatoria',
    placeholder: 'Informe a chave aleatoria',
    helper: '',
  },
};

const PIX_DEFAULTS = {
  merchantName: 'N',
  merchantCity: 'C',
  identifier: '***',
};

function stripAccents(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sanitizeMerchantName(value) {
  return stripAccents(value.trim())
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .substring(0, 25);
}

function sanitizeMerchantCity(value) {
  return stripAccents(value.trim())
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .substring(0, 15);
}

function normalizePixKey(type, value) {
  const trimmed = String(value || '').trim();

  if (type === 'cpf' || type === 'cnpj') {
    return trimmed.replace(/\D/g, '');
  }

  if (type === 'phone') {
    const keepPlus = trimmed.startsWith('+') ? '+' : '';
    return keepPlus + trimmed.replace(/[^\d]/g, '');
  }

  return trimmed;
}

function validatePixKey(type, normalizedKey) {
  if (type === 'cpf') {
    return /^\d{11}$/.test(normalizedKey) ? null : 'CPF invalido. Informe 11 digitos.';
  }

  if (type === 'cnpj') {
    return /^\d{14}$/.test(normalizedKey) ? null : 'CNPJ invalido. Informe 14 digitos.';
  }

  if (type === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedKey) ? null : 'E-mail invalido.';
  }

  if (type === 'phone') {
    return /^\+55\d{10,11}$/.test(normalizedKey)
      ? null
      : 'Telefone invalido. Use o formato com +55.';
  }

  if (type === 'random') {
    return normalizedKey ? null : 'Chave aleatoria invalida.';
  }

  return 'Tipo de chave invalido.';
}

function validatePixForm(input) {
  const normalizedKey = normalizePixKey(input.pixKeyType, input.pixKey);
  const keyError = validatePixKey(input.pixKeyType, normalizedKey);
  const amount = Number(input.amount) || 0;
  const identifier = String(input.identifier || '').trim();

  if (keyError) {
    return { ok: false, error: keyError, field: 'pixKey' };
  }

  if (amount < 0) {
    return { ok: false, error: 'Valor invalido.', field: 'amount' };
  }

  return {
    ok: true,
    normalizedKey,
    merchantName: PIX_DEFAULTS.merchantName,
    merchantCity: PIX_DEFAULTS.merchantCity,
    amount,
    identifier: identifier || PIX_DEFAULTS.identifier,
  };
}

function buildPixPayload(input) {
  const validation = validatePixForm(input);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const pix = new PixPayload(
    validation.normalizedKey,
    validation.merchantName,
    validation.merchantCity,
    validation.amount,
    validation.identifier
  );

  return pix.generate();
}

function getPixKeyConfig(type) {
  return PIX_KEY_CONFIG[type] || PIX_KEY_CONFIG.cpf;
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('pixForm');
  const pixKeyInput = document.getElementById('pixKey');
  const pixKeyTypeInput = document.getElementById('pixKeyType');
  const pixKeyHelper = document.getElementById('pixKeyHelper');
  const identifierInput = document.getElementById('identifier');
  const formError = document.getElementById('formError');
  const qrCanvas = document.getElementById('qrCode');
  const pixCopyPaste = document.getElementById('pixCopyPaste');
  const copyBtn = document.getElementById('copyBtn');
  const amountDisplay = document.getElementById('amountDisplay');
  const resultModal = document.getElementById('resultModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalOverlay = document.getElementById('modalOverlay');

  function updatePixKeyPlaceholder() {
    const { placeholder, helper } = getPixKeyConfig(pixKeyTypeInput.value);
    pixKeyInput.placeholder = placeholder;
    pixKeyHelper.textContent = helper;
  }

  function clearFormError() {
    formError.textContent = '';
    formError.classList.add('hidden');
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.classList.remove('hidden');
  }

  function showModal() {
    resultModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function hideModal() {
    resultModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  function readFormValues() {
    return {
      pixKeyType: pixKeyTypeInput.value,
      pixKey: pixKeyInput.value,
      identifier: identifierInput.value,
      amount: document.getElementById('amount').value,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearFormError();

    const formValues = readFormValues();
    const validation = validatePixForm(formValues);

    if (!validation.ok) {
      showFormError(validation.error);
      hideModal();
      return;
    }

    const payload = buildPixPayload(formValues);

    await QRCode.toCanvas(qrCanvas, payload, {
      width: 240,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    pixCopyPaste.value = payload;

    if (validation.amount > 0) {
      amountDisplay.textContent = `Valor: R$ ${validation.amount.toFixed(2)}`;
      amountDisplay.classList.remove('hidden');
    } else {
      amountDisplay.textContent = '';
      amountDisplay.classList.add('hidden');
    }

    showModal();
  }

  function handleCopy() {
    navigator.clipboard.writeText(pixCopyPaste.value).then(() => {
      const originalText = copyBtn.innerHTML;

      copyBtn.textContent = 'Copiado!';
      copyBtn.classList.remove('bg-emerald-500', 'hover:bg-emerald-400');
      copyBtn.classList.add('bg-slate-900', 'hover:bg-slate-800');

      window.setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.classList.remove('bg-slate-900', 'hover:bg-slate-800');
        copyBtn.classList.add('bg-emerald-500', 'hover:bg-emerald-400');
      }, 1800);
    });
  }

  pixKeyTypeInput.addEventListener('change', updatePixKeyPlaceholder);
  form.addEventListener('submit', handleSubmit);
  copyBtn.addEventListener('click', handleCopy);
  closeModalBtn.addEventListener('click', hideModal);
  modalOverlay.addEventListener('click', hideModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !resultModal.classList.contains('hidden')) {
      hideModal();
    }
  });

  updatePixKeyPlaceholder();
}

if (typeof module !== 'undefined') {
  module.exports = {
    PixPayload,
    normalizePixKey,
    validatePixForm,
    buildPixPayload,
    getPixKeyConfig,
    sanitizeMerchantName,
    sanitizeMerchantCity,
  };
}
