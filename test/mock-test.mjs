// Offline test: runs the built node against a mocked n8n execution context and asserts the HTTP requests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { BuchhaltungsButler } = require('../dist/nodes/BuchhaltungsButler/BuchhaltungsButler.node.js');

const CREDS = {
	apiClient: 'cli',
	apiSecret: 'sec',
	apiKey: 'KEY123',
	baseUrl: 'https://webapp.buchhaltungsbutler.de/api/v1/',
};

function makeContext(params, { responses = [], binary = null } = {}) {
	const calls = [];
	const node = { name: 'BB', type: 'buchhaltungsButler', typeVersion: 1, parameters: params };
	const ctx = {
		calls,
		getInputData: () => [{ json: {}, binary: binary ? { data: binary.meta } : undefined }],
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		getCredentials: async () => CREDS,
		getNode: () => node,
		continueOnFail: () => false,
		helpers: {
			httpRequestWithAuthentication: async (credType, options) => {
				assert.equal(credType, 'buchhaltungsButlerApi');
				calls.push(JSON.parse(JSON.stringify(options)));
				const r = responses.length ? responses.shift() : { success: true, message: '', data: [] };
				if (r instanceof Error) throw r;
				return typeof r === 'function' ? r(options) : r;
			},
			constructExecutionMetaData: (items, { itemData }) => items.map((x) => ({ ...x, pairedItem: itemData })),
			returnJsonArray: (rows) => rows.map((json) => ({ json })),
			assertBinaryData: () => binary.meta,
			getBinaryDataBuffer: async () => binary.buffer,
			prepareBinaryData: async (buffer, fileName, mimeType) => ({
				data: buffer.toString('base64'),
				fileName,
				mimeType,
			}),
		},
	};
	return ctx;
}

async function run(params, opts) {
	const node = new BuchhaltungsButler();
	const ctx = makeContext(params, opts);
	const out = await node.execute.call(ctx);
	return { out: out[0], calls: ctx.calls };
}

const URL = 'https://webapp.buchhaltungsbutler.de/api/v1';
let passed = 0;
async function test(name, fn) {
	try {
		await fn();
		passed++;
		console.log(`✓ ${name}`);
	} catch (e) {
		console.error(`✗ ${name}\n  ${e.stack}`);
		process.exitCode = 1;
	}
}

await test('receipt getMany: filters, sort, pagination with returnAll', async () => {
	const page = (n) => ({ success: true, rows: n, data: Array.from({ length: n }, (_, k) => ({ id_by_customer: String(k) })) });
	const { out, calls } = await run(
		{
			resource: 'receipt',
			operation: 'getMany',
			list_direction: 'inbound',
			returnAll: true,
			filters: { date_from: '2026-01-01T00:00:00', payment_status: 'unpaid', date_since_last_modified: '2026-10-01T13:45:00.000+07:00' },
			sort: { rule: [{ field: 'date', direction: 'DESC' }, { field: 'amount', direction: 'ASC' }] },
		},
		{ responses: [page(500), page(120)] },
	);
	assert.equal(calls.length, 2);
	assert.equal(calls[0].url, `${URL}/receipts/get`);
	assert.equal(calls[0].method, 'POST');
	assert.deepEqual(calls[0].body, {
		list_direction: 'inbound',
		date_from: '2026-01-01',
		payment_status: 'unpaid',
		date_since_last_modified: '2026-10-01 13:45:00',
		order: { date: 'DESC', amount: 'ASC' },
		limit: 500,
		offset: 0,
		api_key: 'KEY123',
	});
	assert.equal(calls[1].body.offset, 500);
	assert.equal(out.length, 620);
});

await test('receipt getMany with limit stops early', async () => {
	const { out, calls } = await run(
		{ resource: 'receipt', operation: 'getMany', list_direction: 'outbound', returnAll: false, limit: 3 },
		{ responses: [{ success: true, data: [{ a: 1 }, { a: 2 }, { a: 3 }] }] },
	);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].body.limit, 3);
	assert.equal(out.length, 3);
});

await test('receipt get: id in path + file download to binary', async () => {
	const { out, calls } = await run(
		{ resource: 'receipt', operation: 'get', idByCustomer: 16, options: { download: true, binaryPropertyName: 'beleg' } },
		{
			responses: [
				{
					success: true,
					data: { id_by_customer: '16', filename: 'receipt16', file_type: 'pdf', file_content: Buffer.from('%PDF-1').toString('base64') },
				},
			],
		},
	);
	assert.equal(calls[0].url, `${URL}/receipts/get/16`);
	assert.deepEqual(calls[0].body, { get_file: true, api_key: 'KEY123' });
	assert.equal(out[0].json.id_by_customer, '16');
	assert.equal(out[0].json.file_content, undefined);
	assert.equal(out[0].binary.beleg.fileName, 'receipt16.pdf');
	assert.equal(out[0].binary.beleg.mimeType, 'application/pdf');
});

await test('receipt delete / restore / transaction get use id path', async () => {
	for (const [resource, operation, path] of [
		['receipt', 'delete', '/receipts/delete/7'],
		['receipt', 'restore', '/receipts/restore/7'],
		['transaction', 'get', '/transactions/get/7'],
	]) {
		const { calls } = await run({ resource, operation, idByCustomer: 7 }, { responses: [{ success: true, data: {} }] });
		assert.equal(calls[0].url, URL + path);
	}
});

await test('receipt upload: binary → base64 + file_name', async () => {
	const { out, calls } = await run(
		{
			resource: 'receipt',
			operation: 'upload',
			binaryPropertyName: 'data',
			type: 'invoice inbound',
			additionalFields: { account: '1200', amount: 119.5, date: '2026-10-28T00:00:00' },
		},
		{
			binary: { meta: { fileName: 'rechnung.pdf', mimeType: 'application/pdf' }, buffer: Buffer.from('PDFDATA') },
			responses: [{ success: true, id_by_customer: '123', filename: 'receipt567' }],
		},
	);
	assert.equal(calls[0].url, `${URL}/receipts/upload`);
	assert.deepEqual(calls[0].body, {
		type: 'invoice inbound',
		account: 1200,
		amount: 119.5,
		date: '2026-10-28',
		file: Buffer.from('PDFDATA').toString('base64'),
		file_name: 'rechnung.pdf',
		api_key: 'KEY123',
	});
	assert.equal(out[0].json.id_by_customer, '123');
});

await test('receipt create keeps empty invoice_number (allowed by API)', async () => {
	const { calls } = await run(
		{
			resource: 'receipt',
			operation: 'create',
			type: 'invoice outbound',
			counterparty: 'Kunde GmbH',
			invoice_number: '',
			date: '2026-10-01',
			amount: 238,
			currency: 'EUR',
		},
		{ responses: [{ success: true }] },
	);
	assert.equal(calls[0].body.invoice_number, '');
	assert.equal(calls[0].body.amount, 238);
});

await test('receipt batch: JSON array validated (max 50)', async () => {
	const ok = await run(
		{ resource: 'receipt', operation: 'createBatch', receipts: '[{"type":"invoice inbound","amount":1}]' },
		{ responses: [{ success: true }] },
	);
	assert.deepEqual(ok.calls[0].body.receipts, [{ type: 'invoice inbound', amount: 1 }]);
	await assert.rejects(
		run({ resource: 'receipt', operation: 'createBatch', receipts: JSON.stringify(new Array(51).fill({})) }),
		/at most 50/,
	);
	await assert.rejects(run({ resource: 'receipt', operation: 'createBatch', receipts: '{"no":' }), /not valid JSON/);
});

await test('transaction create: datetime format + account number', async () => {
	const { calls } = await run(
		{
			resource: 'transaction',
			operation: 'create',
			account: '1200',
			to_from: 'Kunde',
			amount: -50,
			booking_date: '2026-10-28T00:00:00',
			additionalFields: { purpose: 'RE-1', value_date: '2026-10-29' },
		},
		{ responses: [{ success: true }] },
	);
	assert.deepEqual(calls[0].body, {
		account: 1200,
		to_from: 'Kunde',
		amount: -50,
		booking_date: '2026-10-28 00:00:00',
		purpose: 'RE-1',
		value_date: '2026-10-29 00:00:00',
		api_key: 'KEY123',
	});
});

await test('invoice create: items → parallel arrays', async () => {
	const { calls } = await run(
		{
			resource: 'invoice',
			operation: 'create',
			type: 'invoice',
			show_prices_type: 'net',
			company_name: 'Kunde GmbH',
			date: '2026-10-29T00:00:00',
			items: {
				item: [
					{ name: 'Beratung', amount: 2, unit: 'Std.', singlePrice: 150, vat: 19, description: 'PKV' },
					{ name: 'Pauschale', amount: 1, unit: 'Stk.', singlePrice: 19.99, vat: 19, description: '' },
				],
			},
			additionalFields: { due_days: '14', language: 'de_DE', show_bankdata: true },
		},
		{ responses: [{ success: true }] },
	);
	const b = calls[0].body;
	assert.equal(calls[0].url, `${URL}/invoices/create`);
	assert.equal(b.date, '2026-10-29');
	assert.deepEqual(b.item_name, ['Beratung', 'Pauschale']);
	assert.deepEqual(b.item_amount, ['2', '1']);
	assert.deepEqual(b.item_unit, ['Std.', 'Stk.']);
	assert.deepEqual(b.item_vat, ['19', '19']);
	assert.deepEqual(b.item_single_price, ['150', '19.99']);
	assert.deepEqual(b.item_description, ['PKV', '']);
	assert.equal(b.show_bankdata, true);
});

await test('e-invoice: tax types, tax amount only for S', async () => {
	const { calls } = await run(
		{
			resource: 'invoice',
			operation: 'createEInvoice',
			type: 'invoice',
			show_prices_type: 'net',
			company_name: 'Amt',
			date: '2026-10-29',
			e_invoice_id: '0',
			street: 'Str. 1',
			zip: '04109',
			city: 'Leipzig',
			country: 'DE',
			email: 'a@b.de',
			items: {
				item: [
					{ name: 'A', amount: 1, unit: 'Stk.', singlePrice: 10, taxType: 'S', taxAmount: 19 },
					{ name: 'B', amount: 1, unit: 'Stk.', singlePrice: 10, taxType: 'E', taxAmount: 19 },
				],
			},
		},
		{ responses: [{ success: true }] },
	);
	assert.deepEqual(calls[0].body.item_tax_type, ['S', 'E']);
	assert.deepEqual(calls[0].body.item_tax_amount, ['19', '0']);
	assert.equal(calls[0].body.item_vat, undefined);
});

await test('posting addToTransaction: parallel arrays incl. oi nulls', async () => {
	const { calls } = await run(
		{
			resource: 'posting',
			operation: 'addToTransaction',
			transaction_id_by_customer: 55,
			postingLines: {
				line: [
					{ postingAccount: 4930, postingText: 'Büro', vat: '19_pre', amount: -100, costLocation: 'KST1', openItemReceiptId: 0 },
					{ postingAccount: 4940, postingText: 'Abo', vat: '19_pre', amount: -19.5, costLocation: '', openItemReceiptId: 12 },
				],
			},
		},
		{ responses: [{ success: true }] },
	);
	assert.deepEqual(calls[0].body, {
		transaction_id_by_customer: 55,
		postingaccounts: [4930, 4940],
		postingtexts: ['Büro', 'Abo'],
		vats: ['19_pre', '19_pre'],
		amounts: ['-100.00', '-19.50'],
		cost_locations: ['KST1', ''],
		oi_receipts_ids_by_customer: [null, 12],
		api_key: 'KEY123',
	});
});

await test('posting addToReceipt: no oi array, creditor optional', async () => {
	const { calls } = await run(
		{
			resource: 'posting',
			operation: 'addToReceipt',
			receipt_id_by_customer: 9,
			additionalFields: { creditor: 70001 },
			postingLines: { line: [{ postingAccount: 4930, postingText: 'x', vat: '19_pre', amount: 119 }] },
		},
		{ responses: [{ success: true }] },
	);
	assert.equal(calls[0].body.creditor, 70001);
	assert.equal(calls[0].body.oi_receipts_ids_by_customer, undefined);
	assert.deepEqual(calls[0].body.amounts, ['119.00']);
});

await test('postings getMany paginates with 1000', async () => {
	const { calls } = await run(
		{ resource: 'posting', operation: 'getMany', date_from: '2026-01-01', date_to: '2026-12-31', returnAll: true, filters: { order: 'date ASC' } },
		{ responses: [{ success: true, data: [] }] },
	);
	assert.equal(calls[0].body.limit, 1000);
	assert.equal(calls[0].body.order, 'date ASC');
});

await test('accounts getMany: no pagination params, client-side limit', async () => {
	const { out, calls } = await run(
		{ resource: 'account', operation: 'getMany', returnAll: false, limit: 1 },
		{ responses: [{ success: true, data: [{ postingaccount_number: '1200' }, { postingaccount_number: '1000' }] }] },
	);
	assert.deepEqual(calls[0].body, { api_key: 'KEY123' });
	assert.equal(out.length, 1);
});

await test('report getSums: files → binaries', async () => {
	const { out } = await run(
		{ resource: 'report', operation: 'getSums', report_id_by_customer: 3, options: { download: true } },
		{
			responses: [
				{ success: true, report: { sums: {} }, files: { pdf: Buffer.from('p').toString('base64'), csv: null, csv_archive: Buffer.from('z').toString('base64') } },
			],
		},
	);
	assert.deepEqual(Object.keys(out[0].binary).sort(), ['data_csv_archive', 'data_pdf']);
	assert.equal(out[0].binary.data_csv_archive.fileName, 'susa_3.zip');
	assert.equal(out[0].json.files, undefined);
});

await test('API error success:false → NodeApiError with BB message', async () => {
	await assert.rejects(
		run(
			{ resource: 'costLocation', operation: 'delete', code: 'X' },
			{ responses: [{ success: false, error_code: 5, message: 'invalid code specified' }] },
		),
		/BuchhaltungsButler: invalid code specified/,
	);
});

await test('HTTP 400 error body is surfaced', async () => {
	const err = new Error('Request failed with status code 400');
	err.httpCode = '400';
	err.response = { status: 400, body: { success: false, error_code: 6, message: 'no receipt found' } };
	await assert.rejects(run({ resource: 'receipt', operation: 'delete', idByCustomer: 1 }, { responses: [err] }), /no receipt found/);
});

await test('every operation builds a request without throwing on minimal params', async () => {
	const { OPERATIONS } = require('../dist/nodes/BuchhaltungsButler/operations.js');
	for (const op of OPERATIONS) {
		const params = { resource: op.resource, operation: op.value, idByCustomer: 1, returnAll: false, limit: 1, binaryPropertyName: 'data' };
		for (const f of op.fields.filter((x) => x.required)) {
			params[f.key] = f.type === 'json' ? '[]' : f.type === 'number' ? 1 : f.type === 'options' ? (f.options?.[0]?.value ?? '1200') : f.type === 'boolean' ? false : '2026-01-01';
		}
		if (op.special?.includes('invoiceItems') || op.special?.includes('eInvoiceItems')) params.items = { item: [{ name: 'a', amount: 1, unit: 'x', singlePrice: 1, vat: 19, taxType: 'S', taxAmount: 19 }] };
		if (op.special?.some((s) => s.startsWith('postingLines'))) params.postingLines = { line: [{ postingAccount: 1, postingText: 't', vat: '0_none', amount: 1 }] };
		const { calls } = await run(params, {
			binary: { meta: { fileName: 'a.pdf' }, buffer: Buffer.from('x') },
			responses: [{ success: true, data: [] }],
		});
		assert.equal(calls.length, 1, `${op.resource}/${op.value}`);
		assert.ok(calls[0].url.startsWith(URL + '/'), calls[0].url);
		assert.equal(calls[0].body.api_key, 'KEY123');
	}
});

console.log(`\n${passed} test(s) passed`);
