import { createHash } from 'crypto';
import { MulticardAdapter } from '../multicard.adapter';
import type { CallbackData, PaymentGatewayCredentials } from '../../../domain/ports/payment-gateway.port';

const CREDS: PaymentGatewayCredentials = {
  appId: 'rhmt_test',
  storeId: '6',
  secret: 'Pw18axeBFo8V7NamKHXX',
};

describe('MulticardAdapter — signature verification', () => {
  const adapter = new MulticardAdapter();

  function buildSignedCallback(overrides: Partial<CallbackData> = {}): CallbackData {
    const base: CallbackData = {
      storeId: '6',
      invoiceId: '2024864028760',
      amount: 20000,
      uuid: 'e60d8ebc-b9fe-11ef-b159-005056b4367d',
      billingId: '20241214242009869794410864028760',
      cardPan: '860030******5959',
      receiptUrl: 'https://receipt.example/123',
      sign: '',
      ...overrides,
    };
    if (!('sign' in overrides)) {
      const payload = `${base.storeId}${base.invoiceId}${base.amount}${CREDS.secret}`;
      base.sign = createHash('md5').update(payload).digest('hex');
    }
    return base;
  }

  it('verifies valid signature per docs formula MD5(store_id+invoice_id+amount+secret)', () => {
    const cb = buildSignedCallback();
    expect(adapter.verifyCallbackSignature(CREDS.secret, cb)).toBe(true);
  });

  it('rejects callback with tampered amount', () => {
    const cb = buildSignedCallback();
    cb.amount = 99999;
    expect(adapter.verifyCallbackSignature(CREDS.secret, cb)).toBe(false);
  });

  it('rejects callback with wrong store_id', () => {
    const cb = buildSignedCallback();
    cb.storeId = '999';
    expect(adapter.verifyCallbackSignature(CREDS.secret, cb)).toBe(false);
  });

  it('rejects callback with wrong invoice_id', () => {
    const cb = buildSignedCallback();
    cb.invoiceId = 'other-invoice';
    expect(adapter.verifyCallbackSignature(CREDS.secret, cb)).toBe(false);
  });

  it('rejects callback with malformed sign', () => {
    const cb = buildSignedCallback({ sign: 'short' });
    expect(adapter.verifyCallbackSignature(CREDS.secret, cb)).toBe(false);
  });

  it('rejects callback with empty sign', () => {
    const cb = buildSignedCallback({ sign: '' });
    expect(adapter.verifyCallbackSignature(CREDS.secret, cb)).toBe(false);
  });

  it('rejects when secret differs', () => {
    const cb = buildSignedCallback();
    expect(adapter.verifyCallbackSignature('wrong-secret', cb)).toBe(false);
  });

  it('accepts uppercase hex sign (case-insensitive)', () => {
    const cb = buildSignedCallback();
    cb.sign = cb.sign.toUpperCase();
    expect(adapter.verifyCallbackSignature(CREDS.secret, cb)).toBe(true);
  });
});

describe('MulticardAdapter — HTTP integration', () => {
  let adapter: MulticardAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new MulticardAdapter();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockFetch(...responses: Array<{ ok?: boolean; status?: number; body: unknown }>): void {
    let call = 0;
    fetchSpy.mockImplementation(async () => {
      const r = responses[Math.min(call, responses.length - 1)];
      call += 1;
      const text = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      return {
        ok: r.ok ?? true,
        status: r.status ?? 200,
        text: async () => text,
        json: async () => JSON.parse(text),
      } as Response;
    });
  }

  it('caches auth token across calls (single auth request)', async () => {
    mockFetch(
      { body: { token: 'abc123', role: 'dev', expiry: '2099-01-01' } },
      {
        body: {
          success: true,
          data: { uuid: 'u-1', store_id: 6, amount: 100, invoice_id: 'i-1', checkout_url: 'https://co/u-1' },
        },
      },
      {
        body: {
          success: true,
          data: { uuid: 'u-2', store_id: 6, amount: 100, invoice_id: 'i-2', checkout_url: 'https://co/u-2' },
        },
      },
    );

    await adapter.createInvoice(CREDS, {
      invoiceId: 'i-1',
      amount: 1,
      description: 'd',
      callbackUrl: 'https://cb',
      items: [{ name: 'paracetamol', quantity: 1, price: 1, ikpu: '06401004002000000', packageCode: '1506113' }],
    });
    await adapter.createInvoice(CREDS, {
      invoiceId: 'i-2',
      amount: 1,
      description: 'd',
      callbackUrl: 'https://cb',
      items: [{ name: 'paracetamol', quantity: 1, price: 1, ikpu: '06401004002000000', packageCode: '1506113' }],
    });

    const authCalls = fetchSpy.mock.calls.filter((c) => c[0].endsWith('/auth'));
    expect(authCalls).toHaveLength(1);
  });

  it('converts sum to tiyin (×100) in invoice body', async () => {
    mockFetch(
      { body: { token: 'tok' } },
      {
        body: {
          success: true,
          data: { uuid: 'u', store_id: 6, amount: 5500000, invoice_id: 'i', checkout_url: 'https://co' },
        },
      },
    );

    await adapter.createInvoice(CREDS, {
      invoiceId: 'i',
      amount: 55000,
      description: 'd',
      callbackUrl: 'https://cb',
      items: [{ name: 'x', quantity: 2, price: 27500, ikpu: '06401004002000000', packageCode: '1506113' }],
    });

    const invoiceCall = fetchSpy.mock.calls.find((c) => c[0].endsWith('/payment/invoice'));
    expect(invoiceCall).toBeDefined();
    const body = JSON.parse(invoiceCall![1].body as string);
    expect(body.amount).toBe(5_500_000);
    expect(body.ofd[0].price).toBe(2_750_000);
    expect(body.ofd[0].total).toBe(5_500_000);
    expect(body.ofd[0].mxik).toBe('06401004002000000');
    expect(body.ofd[0].package_code).toBe('1506113');
  });

  it('throws when item missing mxik or package_code', async () => {
    mockFetch({ body: { token: 'tok' } });
    await expect(
      adapter.createInvoice(CREDS, {
        invoiceId: 'i',
        amount: 100,
        description: 'd',
        callbackUrl: 'https://cb',
        items: [{ name: 'no-codes', quantity: 1, price: 100 }],
      }),
    ).rejects.toThrow('missing required mxik or package_code');
  });

  it('maps Multicard invoice status to gateway status', async () => {
    mockFetch(
      { body: { token: 'tok' } },
      {
        body: {
          success: true,
          data: {
            uuid: 'u',
            store_id: 6,
            amount: 500000,
            invoice_id: 'i',
            payment: { id: 1, uuid: 'p', status: 'success', total_amount: 500000 },
          },
        },
      },
    );

    const status = await adapter.getInvoiceStatus(CREDS, 'u');
    expect(status.status).toBe('PAID');
    expect(status.amount).toBe(5000);
  });

  it('throws on Multicard error response', async () => {
    mockFetch(
      { body: { token: 'tok' } },
      {
        body: {
          success: false,
          error: { code: 'ERROR_FIELDS', details: 'store_id is required' },
        },
      },
    );

    await expect(
      adapter.createInvoice(CREDS, {
        invoiceId: 'i',
        amount: 100,
        description: 'd',
        callbackUrl: 'https://cb',
        items: [{ name: 'x', quantity: 1, price: 100, ikpu: '06401004002000000', packageCode: '1506113' }],
      }),
    ).rejects.toThrow('store_id is required');
  });

  describe('retry on transient failures', () => {
    it('retries 5xx auth response and succeeds on second attempt', async () => {
      let call = 0;
      fetchSpy.mockImplementation(async () => {
        call += 1;
        if (call === 1) {
          // First auth attempt — 503 Service Unavailable
          return {
            ok: false,
            status: 503,
            text: async () => 'temporary outage',
            json: async () => ({}),
          } as Response;
        }
        if (call === 2) {
          // Second auth attempt succeeds
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ token: 'recovered' }),
            json: async () => ({ token: 'recovered' }),
          } as Response;
        }
        // createInvoice call
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              success: true,
              data: { uuid: 'u', store_id: 6, amount: 100, invoice_id: 'i', checkout_url: 'https://co' },
            }),
          json: async () => ({}),
        } as Response;
      });

      const result = await adapter.createInvoice(CREDS, {
        invoiceId: 'i',
        amount: 1,
        description: 'd',
        callbackUrl: 'https://cb',
        items: [{ name: 'x', quantity: 1, price: 1, ikpu: '06401004002000000', packageCode: '1506113' }],
      });

      expect(result.invoiceId).toBe('u');
      expect(call).toBe(3); // 1 failed auth + 1 retry auth + 1 invoice
    });

    it('retries on network error (fetch throws) then succeeds', async () => {
      let call = 0;
      fetchSpy.mockImplementation(async () => {
        call += 1;
        if (call === 1) {
          throw new TypeError('fetch failed: ECONNRESET');
        }
        if (call === 2) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ token: 'recovered' }),
            json: async () => ({ token: 'recovered' }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              success: true,
              data: {
                uuid: 'u',
                store_id: 6,
                amount: 500000,
                invoice_id: 'i',
                payment: { id: 1, uuid: 'p', status: 'success', total_amount: 500000 },
              },
            }),
          json: async () => ({}),
        } as Response;
      });

      const status = await adapter.getInvoiceStatus(CREDS, 'u');
      expect(status.status).toBe('PAID');
      expect(call).toBe(3);
    });

    it('does NOT retry on 4xx (auth invalid creds)', async () => {
      mockFetch({ ok: false, status: 401, body: 'invalid credentials' });

      await expect(
        adapter.getInvoiceStatus(CREDS, 'u'),
      ).rejects.toThrow(/HTTP 401/);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('gives up after RETRY_MAX_ATTEMPTS (3) and surfaces last error', async () => {
      mockFetch(
        { ok: false, status: 503, body: 'always 503' },
        { ok: false, status: 503, body: 'still 503' },
        { ok: false, status: 503, body: 'final 503' },
      );

      await expect(
        adapter.getInvoiceStatus(CREDS, 'u'),
      ).rejects.toThrow(/HTTP 503/);

      // 3 attempts на auth (caching не помогает первому invoke)
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });
});
