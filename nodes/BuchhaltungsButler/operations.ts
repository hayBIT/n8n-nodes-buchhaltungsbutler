/**
 * Declarative registry of all 58 BuchhaltungsButler API v1 endpoints (spec version 1.9.1).
 * UI properties (descriptions.ts) and request building (BuchhaltungsButler.node.ts) are derived from it.
 */

export type FieldType =
	| 'string'
	| 'number'
	| 'boolean'
	| 'options'
	| 'date'
	| 'datetime'
	| 'json'
	| 'stringList';

export interface FieldOption {
	name: string;
	value: string;
	description?: string;
}

export interface FieldDef {
	/** API parameter name, also used as n8n parameter name */
	key: string;
	/** UI label */
	label: string;
	type: FieldType;
	required?: boolean;
	default?: string | number | boolean;
	description?: string;
	placeholder?: string;
	options?: FieldOption[];
	loadOptionsMethod?: string;
	/** for 'json' batch fields: max array length accepted by the API */
	maxItems?: number;
}

export type Special =
	| 'upload'
	| 'invoiceItems'
	| 'eInvoiceItems'
	| 'postingLinesReceipt'
	| 'postingLinesTransaction'
	| 'receiptOrder'
	| 'receiptFile'
	| 'reportFiles';

export interface OperationDef {
	resource: string;
	value: string;
	name: string;
	action: string;
	description: string;
	path: string;
	/** path ends with the literal segment "id_by_customer" which is replaced by this id */
	idInPath?: { label: string; description: string };
	/** list endpoint with limit/offset pagination */
	list?: { pageSize: number; paginated: boolean };
	fields: FieldDef[];
	special?: Special[];
	/** minimum spacing between consecutive calls (API rate limits) */
	throttleMs?: number;
}

export interface ResourceDef {
	name: string;
	value: string;
	description?: string;
}

// ─────────────────────────────── shared option lists ───────────────────────────────

export const RECEIPT_TYPES: FieldOption[] = [
	{ name: 'Credit Inbound (Eingangsgutschrift § 14 UStG)', value: 'credit inbound' },
	{ name: 'Credit Outbound (Ausgangsgutschrift § 14 UStG)', value: 'credit outbound' },
	{ name: 'Invoice Inbound (Eingangsrechnung)', value: 'invoice inbound' },
	{ name: 'Invoice Outbound (Ausgangsrechnung)', value: 'invoice outbound' },
];

export const VAT_KEYS: FieldOption[] = [
	{ name: '0_none – Keine USt.', value: '0_none' },
	{ name: '19_vat – 19% USt.', value: '19_vat' },
	{ name: '7_vat – 7% USt.', value: '7_vat' },
	{ name: '19_pre – 19% VSt.', value: '19_pre' },
	{ name: '7_pre – 7% VSt.', value: '7_pre' },
	{ name: '19_both_1 – §13b 19% USt./VSt.', value: '19_both_1' },
	{ name: '19_both_506 – §13b 19% USt./VSt. (EU §13b Abs. 1)', value: '19_both_506' },
	{ name: '19_both_6506 – §13b 19% USt. (EU §13b Abs. 1, Ohne VSt.)', value: '19_both_6506' },
	{ name: '19_both_511 – §13b 19% USt./VSt. (Drittland §13b Abs. 2 Nr. 1)', value: '19_both_511' },
	{
		name: '19_both_6511 – §13b 19% USt. (Drittland §13b Abs. 2 Nr. 1, Ohne VSt.)',
		value: '19_both_6511',
	},
	{ name: '19_both_6501 – §13b 19/16% USt. (Ohne VSt.)', value: '19_both_6501' },
	{ name: '19_both_2 – I.g.E. 19% USt./VSt.', value: '19_both_2' },
	{ name: '7_both – I.g.E. 7% USt./VSt.', value: '7_both' },
	{ name: '19_both_1_no_pre – §13b 19/16% USt.', value: '19_both_1_no_pre' },
	{ name: '19_both_2_no_pre – I.g.E. 19/16% USt.', value: '19_both_2_no_pre' },
	{ name: '7_both_no_pre – I.g.E. 7/5% USt.', value: '7_both_no_pre' },
	{ name: '19_pre_app – 19/16% Aufz. VSt.', value: '19_pre_app' },
	{ name: '7_pre_app – 7/5% Aufz. VSt.', value: '7_pre_app' },
	{ name: '19_both_app_1 – §13b 19/16% USt./Aufz. VSt.', value: '19_both_app_1' },
	{
		name: '19_both_app_506 – §13b 19/16% USt./Aufz. VSt. (EU §13b Abs. 1)',
		value: '19_both_app_506',
	},
	{
		name: '19_both_app_511 – §13b 19/16% USt./Aufz. VSt. (Drittland §13b Abs. 2 Nr. 1)',
		value: '19_both_app_511',
	},
	{ name: '19_both_app_2 – I.g.E. 19/16% USt./Aufz. VSt.', value: '19_both_app_2' },
	{ name: '7_both_app – I.g.E. 7/5% USt./Aufz. VSt.', value: '7_both_app' },
];

export const E_INVOICE_TAX_TYPES: FieldOption[] = [
	{ name: 'AE – Reverse Charge (§13b)', value: 'AE' },
	{ name: 'E – VAT Exempt Supply & Services', value: 'E' },
	{ name: 'G – Third Country Supply (Export)', value: 'G' },
	{ name: 'K – EU Supply (Intra-Community)', value: 'K' },
	{ name: 'S – VAT (Standard Rate)', value: 'S' },
	{ name: 'Z – 0% VAT', value: 'Z' },
];

const REPORT_BASE: FieldOption[] = [
	{ name: 'Booking Date (Buchungsdatum)', value: 'date' },
	{ name: 'Delivery Date Else Booking Date (Buchungs- Und Leistungsdatum)', value: 'date_delivery_else_date' },
];

// ─────────────────────────────── reusable field blocks ───────────────────────────────

const f = {
	date: (name: string, displayName: string, description: string, required = false): FieldDef => ({
		key: name,
		label: displayName,
		type: 'date',
		required,
		description: `${description} (YYYY-MM-DD)`,
	}),
	int: (name: string, displayName: string, description: string, required = false): FieldDef => ({
		key: name,
		label: displayName,
		type: 'number',
		required,
		default: 0,
		description,
	}),
	str: (name: string, displayName: string, description: string, required = false): FieldDef => ({
		key: name,
		label: displayName,
		type: 'string',
		required,
		description,
	}),
	bool: (name: string, displayName: string, description: string): FieldDef => ({
		key: name,
		label: displayName,
		type: 'boolean',
		default: false,
		description,
	}),
};

const receiptOptionalFields: FieldDef[] = [
	{
		key: 'account',
		label: 'Payment Account Name or ID',
		type: 'options',
		loadOptionsMethod: 'getPaymentAccounts',
		description:
			'Assign the receipt directly to a payment account (posting account number, e.g. 1200). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	f.int(
		'creditor_debtor',
		'Creditor/Debtor Number',
		'Posting account number of the creditor (inbound) or debtor (outbound), e.g. 70001',
	),
	f.str('payment_reference', 'Payment Reference', 'Payment reference ID used to match a transaction'),
	f.date('date_delivery', 'Delivery Date', 'Must not be after the receipt date (DATEV)'),
	f.date('date_payment_due', 'Payment Due Date', 'Payment due date'),
	f.int(
		'link_to_receipt_id_by_customer',
		'Link to Receipt ID',
		'ID (id_by_customer) of another receipt; both are assigned together to a transaction',
	),
	{
		key: 'vat_rate',
		label: 'VAT Rate',
		type: 'number',
		default: 19,
		description: 'VAT rate of the receipt, e.g. 19 or 0',
	},
];

const addressFields = (prefix: 'new' | 'update', entity: string, withCustomerNumber: boolean): FieldDef[] => {
	const verb = prefix === 'new' ? '' : 'New ';
	const list: FieldDef[] = [
		f.str('contact_person_name', 'Contact Person Name', `${verb}contact person of the ${entity}`),
		f.str('street', 'Street', `${verb}street of the ${entity}`),
		f.str('additional_address_line', 'Additional Address Line', `${verb}additional address line`),
		f.str('zip', 'ZIP', `${verb}ZIP code`),
		f.str('city', 'City', `${verb}city`),
		f.str('country', 'Country', 'German country name (e.g. Dänemark) or ISO 3166-1 alpha-2 code (e.g. DK)'),
		f.str('sales_tax_id', 'Sales Tax ID', 'VAT ID (USt-IdNr.)'),
		{ ...f.str('email', 'Email', `Email address of the ${entity}`), placeholder: 'name@email.com' },
		f.str('iban', 'IBAN', 'IBAN'),
		f.str('bic', 'BIC', 'BIC'),
	];
	if (withCustomerNumber) list.splice(3, 0, f.str('customer_number', 'Customer Number', 'Customer number'));
	return list;
};

const invoiceOptionalFields = (opts: { invoiceNumber: boolean; dueDays: boolean; paymentRef: boolean; address: boolean }): FieldDef[] => {
	const list: FieldDef[] = [];
	list.push(f.str('contact_person_name', 'Contact Person Name', 'Contact person at the recipient company'));
	if (opts.address) {
		list.push(
			f.str('street', 'Street', 'Street of the recipient'),
			f.str('zip', 'ZIP', 'ZIP code of the recipient'),
			f.str('city', 'City', 'City of the recipient'),
			f.str('country', 'Country', 'German country name (e.g. Dänemark) or ISO code (e.g. DK)'),
			{ ...f.str('email', 'Email', 'Email address for sending the invoice'), placeholder: 'name@email.com' },
		);
	}
	list.push(
		f.str('additional_addressline', 'Additional Address Line', 'Additional address information'),
		{
			key: 'recurring_interval',
			label: 'Recurring Interval',
			type: 'options',
			default: 'monthly',
			description: 'Interval for recurring invoices (requires Recurring Next Date)',
			options: [
				{ name: 'Monthly', value: 'monthly' },
				{ name: 'Quarterly', value: 'quarterly' },
				{ name: 'Weekly', value: 'weekly' },
				{ name: 'Yearly', value: 'yearly' },
			],
		},
		f.date('recurring_date_next', 'Recurring Next Date', 'Next date of the recurring invoice'),
		f.str(
			'date_of_supply',
			'Date of Supply',
			'Date or period of service/delivery (Leistungsdatum). YYYY-MM-DD is also taken over as delivery date.',
		),
	);
	if (opts.invoiceNumber)
		list.push(f.str('invoicenumber', 'Invoice Number', 'If empty, the default BHB number is created'));
	list.push(
		f.str('correspondence', 'Correspondence', 'Optional correspondence text to the recipient'),
		{
			key: 'discount_type',
			label: 'Discount Type',
			type: 'options',
			default: 'percent',
			description: 'Type of the discount',
			options: [
				{ name: 'Percent', value: 'percent' },
				{ name: 'EUR', value: 'EUR' },
			],
		},
		f.str('discount_value', 'Discount Value', 'Value of the discount'),
		f.str('payment_conditions', 'Payment Conditions', 'Payment conditions text'),
	);
	if (opts.dueDays) list.push(f.str('due_days', 'Due Days', 'Days between invoice date and due date'));
	list.push(
		f.str('final_provisions', 'Final Provisions', 'Closing text of the invoice'),
		f.bool('show_bankdata', 'Show Bank Data', 'Whether to show the bank data on the invoice'),
		f.bool('show_contactdata', 'Show Contact Data', 'Whether to show the contact data on the invoice'),
		f.str('customer_number', 'Customer Number', 'Customer number of the recipient'),
	);
	if (opts.paymentRef)
		list.push(
			f.str('payment_reference', 'Payment Reference', 'Amazon order ID, PayPal or Stripe transaction ID'),
		);
	list.push({
		key: 'language',
		label: 'Language',
		type: 'options',
		default: 'de_DE',
		description: 'Language of the invoice labels',
		options: [
			{ name: 'Deutsch', value: 'de_DE' },
			{ name: 'English', value: 'en_US' },
		],
	});
	return list;
};

const invoiceRequiredFields: FieldDef[] = [
	{
		key: 'type',
		label: 'Type',
		type: 'options',
		required: true,
		default: 'invoice',
		description: 'Document type',
		options: [
			{ name: 'Credit (Gutschrift)', value: 'credit' },
			{ name: 'Invoice (Rechnung)', value: 'invoice' },
			{ name: 'Offer (Angebot)', value: 'offer' },
		],
	},
	{
		key: 'show_prices_type',
		label: 'Show Prices',
		type: 'options',
		required: true,
		default: 'net',
		description: 'Whether item prices are net or gross',
		options: [
			{ name: 'Net (Netto)', value: 'net' },
			{ name: 'Gross (Brutto)', value: 'gross' },
		],
	},
	f.str('company_name', 'Company Name', 'Company name of the recipient', true),
	f.date('date', 'Date', 'Invoice date', true),
];


// ─────────────────────────────── resources ───────────────────────────────

export const RESOURCES: ResourceDef[] = [
	{ name: 'Account (Basiskonto)', value: 'account' },
	{ name: 'Comment', value: 'comment' },
	{ name: 'Cost Location (Kostenstelle)', value: 'costLocation' },
	{ name: 'Creditor (Kreditor)', value: 'creditor' },
	{ name: 'Debtor (Debitor)', value: 'debtor' },
	{ name: 'Invoice (Rechnung)', value: 'invoice' },
	{ name: 'Posting (Buchung)', value: 'posting' },
	{ name: 'Posting Account (Sachkonto)', value: 'postingAccount' },
	{ name: 'Receipt (Beleg)', value: 'receipt' },
	{ name: 'Report', value: 'report' },
	{ name: 'Transaction (Umsatz)', value: 'transaction' },
];

// ─────────────────────────────── operations ───────────────────────────────

export const OPERATIONS: OperationDef[] = [
	// ── Receipt ────────────────────────────────────────────────
	{
		resource: 'receipt',
		value: 'getMany',
		name: 'Get Many',
		action: 'Get many receipts',
		description: 'List inbound or outbound receipts',
		path: '/receipts/get',
		list: { pageSize: 500, paginated: true },
		special: ['receiptOrder'],
		fields: [
			{
				key: 'list_direction',
				label: 'Direction',
				type: 'options',
				required: true,
				default: 'inbound',
				description: 'Inbound (Eingangsbelege) or outbound (Ausgangsbelege) receipts',
				options: [
					{ name: 'Inbound (Eingangsbelege)', value: 'inbound' },
					{ name: 'Outbound (Ausgangsbelege)', value: 'outbound' },
				],
			},
			{
				key: 'payment_status',
				label: 'Payment Status',
				type: 'options',
				default: 'unpaid',
				description: 'Filter by payment status',
				options: [
					{ name: 'Paid', value: 'paid' },
					{ name: 'Unpaid', value: 'unpaid' },
				],
			},
			f.str('counterparty', 'Counterparty', 'Invoicing party (inbound) or recipient (outbound)'),
			f.date('date_from', 'Date From', 'Issuing date on or after'),
			f.date('date_to', 'Date To', 'Issuing date on or before'),
			{
				key: 'date_since_last_modified',
				label: 'Modified Since',
				type: 'datetime',
				description: 'Only receipts updated after this point in time (YYYY-MM-DD HH:MM:SS)',
			},
			f.str('invoicenumber', 'Invoice Number', 'Only receipts with this invoice number'),
			f.date('due_date', 'Due Date', 'Only receipts with exactly this due date'),
			f.bool('include_offers', 'Include Offers', 'Whether to include offers'),
			f.bool('deleted', 'Only Deleted', 'Whether to return only deleted receipts'),
		],
	},
	{
		resource: 'receipt',
		value: 'get',
		name: 'Get',
		action: 'Get a receipt',
		description: 'Get a single receipt by ID',
		path: '/receipts/get/id_by_customer',
		idInPath: { label: 'Receipt ID', description: 'The id_by_customer of the receipt' },
		special: ['receiptFile'],
		fields: [],
	},
	{
		resource: 'receipt',
		value: 'create',
		name: 'Create (Without File)',
		action: 'Create a receipt without file',
		description: 'Add a receipt without a file',
		path: '/receipts/add',
		fields: [
			{ key: 'type', label: 'Type', type: 'options', required: true, default: 'invoice inbound', options: RECEIPT_TYPES, description: 'Receipt type' },
			f.str('counterparty', 'Counterparty', 'Invoicing party (inbound) or recipient (outbound)', true),
			{ ...f.str('invoice_number', 'Invoice Number', 'Invoice number (max. 60 characters), may be empty'), required: true },
			f.date('date', 'Date', 'Issuing date', true),
			{ key: 'amount', label: 'Amount', type: 'number', required: true, default: 0, description: 'Total amount, negative for reversals. 0 is not valid.' },
			{ ...f.str('currency', 'Currency', 'Currency code, e.g. EUR'), required: true, default: 'EUR' },
			...receiptOptionalFields,
		],
	},
	{
		resource: 'receipt',
		value: 'createBatch',
		name: 'Create Many (Batch)',
		action: 'Create many receipts',
		description: 'Add up to 50 receipts without files in one request (max. 1 request per 5 seconds).',
		path: '/receipts/addBatch',
		throttleMs: 5000,
		fields: [
			{
				key: 'receipts',
				label: 'Receipts (JSON)',
				type: 'json',
				required: true,
				maxItems: 50,
				default: '[\n  {\n    "type": "invoice inbound",\n    "counterparty": "Lieferant GmbH",\n    "invoice_number": "RE-1001",\n    "date": "2026-01-31",\n    "amount": 119.0,\n    "currency": "EUR",\n    "vat_rate": 19\n  }\n]',
				description: 'Array of receipt objects with the same fields as "Create (Without File)"',
			},
		],
	},
	{
		resource: 'receipt',
		value: 'upload',
		name: 'Upload',
		action: 'Upload a receipt file',
		description: 'Upload a receipt file (PDF, XML, JPEG, PNG, BMP, TIFF) for OCR processing (max. 10 per minute).',
		path: '/receipts/upload',
		throttleMs: 6000,
		special: ['upload'],
		fields: [
			{ key: 'type', label: 'Type', type: 'options', required: true, default: 'invoice inbound', options: RECEIPT_TYPES, description: 'Receipt type' },
			f.str('file_name', 'File Name', 'File name sent to BuchhaltungsButler. Defaults to the binary file name.'),
			f.str('counterparty', 'Counterparty', 'Ignored for e-invoices'),
			f.str('invoice_number', 'Invoice Number', 'Ignored for e-invoices'),
			f.date('date', 'Date', 'Issuing date, ignored for e-invoices'),
			{ key: 'amount', label: 'Amount', type: 'number', default: 0, description: 'Total amount, ignored for e-invoices' },
			{ ...f.str('currency', 'Currency', 'Must be EUR if specified'), default: 'EUR' },
			...receiptOptionalFields,
		],
	},
	{
		resource: 'receipt',
		value: 'delete',
		name: 'Delete',
		action: 'Delete a receipt',
		description: 'Mark a receipt as deleted',
		path: '/receipts/delete/id_by_customer',
		idInPath: { label: 'Receipt ID', description: 'The id_by_customer of the receipt' },
		fields: [],
	},
	{
		resource: 'receipt',
		value: 'restore',
		name: 'Restore',
		action: 'Restore a receipt',
		description: 'Restore a receipt marked as deleted',
		path: '/receipts/restore/id_by_customer',
		idInPath: { label: 'Receipt ID', description: 'The id_by_customer of the receipt' },
		fields: [],
	},
	{
		resource: 'receipt',
		value: 'getAssignedTransactions',
		name: 'Get Assigned Transactions',
		action: 'Get transactions assigned to a receipt',
		description: 'Get all transactions assigned to a receipt',
		path: '/receipts/assigned-transactions/get',
		fields: [
			f.int('receipt_id_by_customer', 'Receipt ID', 'The id_by_customer of the receipt', true),
			f.bool('confirmed_only', 'Confirmed Only', 'Whether to return only confirmed assignments'),
		],
	},

	// ── Transaction ────────────────────────────────────────────
	{
		resource: 'transaction',
		value: 'getMany',
		name: 'Get Many',
		action: 'Get many transactions',
		description: 'List bank/payment transactions',
		path: '/transactions/get',
		list: { pageSize: 500, paginated: true },
		fields: [
			f.date('date_from', 'Date From', 'Booking date on or after'),
			f.date('date_to', 'Date To', 'Booking date on or before'),
			{
				key: 'account',
				label: 'Payment Account Name or ID',
				type: 'options',
				loadOptionsMethod: 'getPaymentAccounts',
				description:
					'Only transactions of this payment account. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			f.str('to_from', 'Payer/Payee', 'Payer or payee of the transaction'),
			{
				key: 'date_since_last_modified',
				label: 'Modified Since',
				type: 'datetime',
				description: 'Only transactions updated after this point in time (YYYY-MM-DD HH:MM:SS)',
			},
			f.int('id_by_customer_from', 'ID Greater Than', 'Only transactions with id_by_customer greater than this value (exclusive, sorts by ID ASC)'),
			f.int('id_by_customer_to', 'ID Less Than', 'Only transactions with id_by_customer less than this value (exclusive, sorts by ID ASC)'),
		],
	},
	{
		resource: 'transaction',
		value: 'get',
		name: 'Get',
		action: 'Get a transaction',
		description: 'Get a single transaction by ID',
		path: '/transactions/get/id_by_customer',
		idInPath: { label: 'Transaction ID', description: 'The id_by_customer of the transaction' },
		fields: [],
	},
	{
		resource: 'transaction',
		value: 'create',
		name: 'Create',
		action: 'Create a transaction',
		description: 'Add a transaction to a payment account',
		path: '/transactions/add',
		fields: [
			{
				key: 'account',
				label: 'Payment Account Name or ID',
				type: 'options',
				required: true,
				loadOptionsMethod: 'getPaymentAccounts',
				description:
					'Payment account (posting account number, e.g. 1200). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			f.str('to_from', 'Payer/Payee', 'Payment recipient or sender', true),
			{ key: 'amount', label: 'Amount', type: 'number', required: true, default: 0, description: 'Positive for incoming, negative for outgoing payments' },
			{ key: 'booking_date', label: 'Booking Date', type: 'datetime', required: true, description: 'Booking date (YYYY-MM-DD HH:MM:SS)' },
			{ key: 'value_date', label: 'Value Date', type: 'datetime', description: 'Value date, defaults to booking date' },
			f.str('account_number', 'Account Number / IBAN', 'Account number or IBAN of the counterparty'),
			f.str('bank_code', 'Bank Code / BIC', 'Bank code or BIC of the counterparty'),
			f.str('bank_name', 'Bank Name', 'Bank name of the counterparty'),
			f.str('purpose', 'Purpose', 'Transaction purpose (Verwendungszweck)'),
			f.str('type', 'Transaction Type', 'E.g. Direct debit'),
			f.str('booking_text', 'Booking Text', 'Booking text'),
			f.str('payment_reference', 'Payment Reference', 'Payment reference ID used to match a receipt'),
			f.str('currency', 'Currency', 'ISO currency code, e.g. EUR'),
		],
	},
	{
		resource: 'transaction',
		value: 'createBatch',
		name: 'Create Many (Batch)',
		action: 'Create many transactions',
		description: 'Add up to 50 transactions in one request (max. 1 request per 5 seconds).',
		path: '/transactions/addBatch',
		throttleMs: 5000,
		fields: [
			{
				key: 'transactions',
				label: 'Transactions (JSON)',
				type: 'json',
				required: true,
				maxItems: 50,
				default: '[\n  {\n    "account": 1200,\n    "to_from": "Kunde GmbH",\n    "amount": 119.0,\n    "booking_date": "2026-01-31 00:00:00",\n    "purpose": "RE-1001"\n  }\n]',
				description: 'Array of transaction objects with the same fields as "Create"',
			},
		],
	},
	{
		resource: 'transaction',
		value: 'delete',
		name: 'Delete',
		action: 'Delete a transaction',
		description: 'Delete a transaction (revision-safe accounts get a STORNO transaction instead)',
		path: '/transactions/delete',
		fields: [f.int('transaction_id_by_customer', 'Transaction ID', 'The id_by_customer of the transaction', true)],
	},
	{
		resource: 'transaction',
		value: 'assignReceipt',
		name: 'Assign Receipt',
		action: 'Assign a receipt to a transaction',
		description: 'Assign a receipt to a transaction',
		path: '/transactions/assign/receipt',
		fields: [
			f.int('transaction_id_by_customer', 'Transaction ID', 'The id_by_customer of the transaction', true),
			f.int('receipt_id_by_customer', 'Receipt ID', 'The id_by_customer of the receipt', true),
		],
	},
	{
		resource: 'transaction',
		value: 'unassignReceipt',
		name: 'Unassign Receipt',
		action: 'Unassign a receipt from a transaction',
		description: 'Remove a receipt assignment from a transaction',
		path: '/transactions/unassign/receipt',
		fields: [
			f.int('transaction_id_by_customer', 'Transaction ID', 'The id_by_customer of the transaction', true),
			f.int('receipt_id_by_customer', 'Receipt ID', 'The id_by_customer of the receipt', true),
		],
	},
	{
		resource: 'transaction',
		value: 'assignReceiptsBatch',
		name: 'Assign Receipts (Batch)',
		action: 'Assign many receipts to transactions',
		description: 'Assign up to 50 receipts to transactions in one request',
		path: '/transactions/assign-batch/receipt',
		fields: [
			{
				key: 'transactions_to_receipts',
				label: 'Assignments (JSON)',
				type: 'json',
				required: true,
				maxItems: 50,
				default: '[\n  { "transaction_id_by_customer": 123, "receipt_id_by_customer": 456 }\n]',
				description: 'Array of {transaction_id_by_customer, receipt_id_by_customer}',
			},
		],
	},
	{
		resource: 'transaction',
		value: 'getAssignedReceipts',
		name: 'Get Assigned Receipts',
		action: 'Get receipts assigned to a transaction',
		description: 'Get all receipts assigned to a transaction',
		path: '/transactions/assigned-receipts/get',
		fields: [
			f.int('transaction_id_by_customer', 'Transaction ID', 'The id_by_customer of the transaction', true),
			f.bool('confirmed_only', 'Confirmed Only', 'Whether to return only confirmed assignments'),
		],
	},

	// ── Invoice ───────────────────────────────────────────────
	{
		resource: 'invoice',
		value: 'create',
		name: 'Create',
		action: 'Create an invoice',
		description: 'Create an invoice, credit or offer',
		path: '/invoices/create',
		special: ['invoiceItems'],
		fields: [
			...invoiceRequiredFields,
			...invoiceOptionalFields({ invoiceNumber: true, dueDays: true, paymentRef: true, address: true }),
		],
	},
	{
		resource: 'invoice',
		value: 'createEInvoice',
		name: 'Create E-Invoice',
		action: 'Create an e-invoice',
		description: 'Create an e-invoice (ZUGFeRD/XRechnung)',
		path: '/invoices/create/e-invoice',
		special: ['eInvoiceItems'],
		fields: [
			...invoiceRequiredFields,
			{ ...f.str('e_invoice_id', 'Buyer Reference (Leitweg-ID)', 'Buyer reference, use 0 if none'), required: true, default: '0' },
			f.str('street', 'Street', 'Street of the recipient', true),
			f.str('zip', 'ZIP', 'ZIP code of the recipient', true),
			f.str('city', 'City', 'City of the recipient', true),
			f.str('country', 'Country', 'German country name or ISO code (e.g. DE)', true),
			{ ...f.str('email', 'Email', 'Email address of the recipient', true), placeholder: 'name@email.com' },
			...invoiceOptionalFields({ invoiceNumber: true, dueDays: true, paymentRef: true, address: false }),
		],
	},
	{
		resource: 'invoice',
		value: 'createDraft',
		name: 'Create Draft',
		action: 'Create an invoice draft',
		description: 'Create an invoice draft',
		path: '/invoices/create/draft',
		special: ['invoiceItems'],
		fields: [
			...invoiceRequiredFields,
			...invoiceOptionalFields({ invoiceNumber: false, dueDays: false, paymentRef: false, address: true }),
		],
	},
	{
		resource: 'invoice',
		value: 'createCorrection',
		name: 'Create Correction',
		action: 'Create an invoice correction',
		description: 'Create an invoice correction (Rechnungskorrektur) for an existing outbound invoice',
		path: '/invoices/invoice_correction/create',
		fields: [f.int('receipt_id_by_customer', 'Receipt ID', 'The id_by_customer of the outbound invoice to correct', true)],
	},

	// ── Posting ───────────────────────────────────────────────
	{
		resource: 'posting',
		value: 'getMany',
		name: 'Get Many',
		action: 'Get many postings',
		description: 'List postings in a date range',
		path: '/postings/get',
		list: { pageSize: 1000, paginated: true },
		fields: [
			f.date('date_from', 'Date From', 'Posting date on or after', true),
			f.date('date_to', 'Date To', 'Posting date on or before', true),
			f.date('date_last_action_from', 'Last Action From', 'Created or status-changed on or after'),
			f.date('date_last_action_to', 'Last Action To', 'Created or status-changed on or before'),
			f.str('account', 'Accounts', 'Comma-separated: all, all financial accounts, free booking, or account numbers'),
			f.str('postingaccount', 'Posting Accounts', 'Comma-separated: all, all postingaccounts, all debtors, all creditors, or numbers'),
			{
				key: 'posting_status',
				label: 'Posting Status',
				type: 'options',
				default: 'all',
				description: 'Filter by fixed status (festgeschrieben)',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Fixed', value: 'fixed' },
					{ name: 'Unfixed', value: 'unfixed' },
				],
			},
			f.str('cost_location', 'Cost Location', 'Only postings to this cost location code'),
			{
				key: 'order',
				label: 'Order',
				type: 'options',
				default: 'default',
				description: 'Sort order',
				options: [
					{ name: 'Date ASC', value: 'date ASC' },
					{ name: 'Date DESC', value: 'date DESC' },
					{ name: 'Date Last Action ASC', value: 'date_last_action ASC' },
					{ name: 'Date Last Action DESC', value: 'date_last_action DESC' },
					{ name: 'Default', value: 'default' },
					{ name: 'ID ASC', value: 'id_by_customer ASC' },
					{ name: 'ID DESC', value: 'id_by_customer DESC' },
				],
			},
		],
	},
	{
		resource: 'posting',
		value: 'addToReceipt',
		name: 'Add to Receipt',
		action: 'Add postings to a receipt',
		description: 'Add posting lines to a receipt (requires creditor/debtor posting)',
		path: '/postings/add/receipt',
		special: ['postingLinesReceipt'],
		fields: [
			f.int('receipt_id_by_customer', 'Receipt ID', 'The id_by_customer of the receipt', true),
			f.int('creditor', 'Creditor Number', 'Required for inbound invoices when creditor posting is active'),
			f.int('debtor', 'Debtor Number', 'Required for outbound invoices when debtor posting is active'),
		],
	},
	{
		resource: 'posting',
		value: 'addToReceiptsBatch',
		name: 'Add to Receipts (Batch)',
		action: 'Add postings to many receipts',
		description: 'Add postings to multiple receipts in one request',
		path: '/postings/add-batch/receipts',
		fields: [
			{
				key: 'receipts',
				label: 'Receipt Postings (JSON)',
				type: 'json',
				required: true,
				default: '[\n  {\n    "receipt_id_by_customer": 123,\n    "postingaccounts": [4930],\n    "postingtexts": ["Bürobedarf"],\n    "vats": ["19_pre"],\n    "amounts": ["119.00"],\n    "creditor": 70001\n  }\n]',
				description: 'Array of objects with the same fields as "Add to Receipt" (parallel arrays)',
			},
		],
	},
	{
		resource: 'posting',
		value: 'addToTransaction',
		name: 'Add to Transaction',
		action: 'Add postings to a transaction',
		description: 'Add posting lines to a transaction',
		path: '/postings/add/transaction',
		special: ['postingLinesTransaction'],
		fields: [f.int('transaction_id_by_customer', 'Transaction ID', 'The id_by_customer of the transaction', true)],
	},
	{
		resource: 'posting',
		value: 'addToTransactionsBatch',
		name: 'Add to Transactions (Batch)',
		action: 'Add postings to many transactions',
		description: 'Add postings to multiple transactions in one request',
		path: '/postings/add-batch/transactions',
		fields: [
			{
				key: 'transactions',
				label: 'Transaction Postings (JSON)',
				type: 'json',
				required: true,
				default: '[\n  {\n    "transaction_id_by_customer": 123,\n    "postingaccounts": [4930],\n    "postingtexts": ["Bürobedarf"],\n    "vats": ["19_pre"],\n    "amounts": ["-119.00"],\n    "oi_receipts_ids_by_customer": [null]\n  }\n]',
				description: 'Array of objects with the same fields as "Add to Transaction" (parallel arrays)',
			},
		],
	},
	{
		resource: 'posting',
		value: 'addFree',
		name: 'Add Free Posting',
		action: 'Add a free posting',
		description: 'Add a free posting (Freie Buchung) between two accounts',
		path: '/postings/add/free',
		fields: [
			f.date('date', 'Date', 'Posting date', true),
			f.str('postingtext', 'Posting Text', 'Description of the posting', true),
			{ ...f.str('amount', 'Amount', 'Amount, e.g. 119.00'), required: true },
			f.int('postingaccount_debit', 'Debit Account', 'Debit posting account number (Soll)', true),
			f.int('postingaccount_credit', 'Credit Account', 'Credit posting account number (Haben)', true),
			{ key: 'vat', label: 'VAT Key', type: 'options', required: true, default: '0_none', options: VAT_KEYS, description: 'VAT key of the posting' },
			f.str('cost_location', 'Cost Location', 'Cost location code'),
			f.str('cost_location_two', 'Cost Location Two', 'Second cost location code'),
			f.str('oss_origin_country', 'OSS Origin Country', 'ISO 3166-1 alpha-2, only for OSS VAT keys'),
			f.str('oss_destination_country', 'OSS Destination Country', 'ISO 3166-1 alpha-2, only for OSS VAT keys'),
			f.str('oss_vat_rate', 'OSS VAT Rate', 'VAT rate, only for OSS VAT keys'),
		],
	},
	{
		resource: 'posting',
		value: 'addFreeBatch',
		name: 'Add Free Postings (Batch)',
		action: 'Add many free postings',
		description: 'Add multiple free postings in one request',
		path: '/postings/add-batch/free',
		fields: [
			{
				key: 'free_postings',
				label: 'Free Postings (JSON)',
				type: 'json',
				required: true,
				default: '[\n  {\n    "date": "2026-01-31",\n    "postingtext": "Umbuchung",\n    "amount": 100.0,\n    "postingaccount_debit": 1590,\n    "postingaccount_credit": 1200,\n    "vat": "0_none"\n  }\n]',
				description: 'Array of objects with the same fields as "Add Free Posting"',
			},
		],
	},
	{
		resource: 'posting',
		value: 'unconfirmReceipt',
		name: 'Unconfirm Receipt Postings',
		action: 'Unconfirm receipt postings',
		description: 'Remove (unconfirm) the not-fixed postings of a receipt',
		path: '/postings/unconfirm/receipt',
		fields: [f.int('receipt_id_by_customer', 'Receipt ID', 'The id_by_customer of the receipt', true)],
	},
	{
		resource: 'posting',
		value: 'unconfirmTransaction',
		name: 'Unconfirm Transaction Postings',
		action: 'Unconfirm transaction postings',
		description: 'Remove (unconfirm) the not-fixed postings of a transaction',
		path: '/postings/unconfirm/transaction',
		fields: [f.int('transaction_id_by_customer', 'Transaction ID', 'The id_by_customer of the transaction', true)],
	},
	{
		resource: 'posting',
		value: 'unconfirmFree',
		name: 'Unconfirm Free Posting',
		action: 'Unconfirm a free posting',
		description: 'Remove (unconfirm) a not-fixed free posting',
		path: '/postings/unconfirm/free',
		fields: [f.int('posting_id_by_customer', 'Posting ID', 'The id_by_customer of the free posting', true)],
	},
	{
		resource: 'posting',
		value: 'assignReceiptToFree',
		name: 'Assign Receipt to Free Posting',
		action: 'Assign a receipt to a free posting',
		description: 'Assign a receipt to a free posting',
		path: '/postings/assign/receipt-to-free-posting',
		fields: [
			f.int('receipt_id_by_customer', 'Receipt ID', 'The id_by_customer of the receipt', true),
			f.int('posting_id_by_customer', 'Posting ID', 'The id_by_customer of the free posting', true),
		],
	},
	{
		resource: 'posting',
		value: 'cancel',
		name: 'Cancel',
		action: 'Cancel a posting',
		description: 'Delete a not-fixed posting or reverse a fixed one (Storno)',
		path: '/postings/cancel',
		fields: [f.int('posting_id_by_customer', 'Posting ID', 'The id_by_customer of the posting', true)],
	},

	// ── Debtor ────────────────────────────────────────────────
	{
		resource: 'debtor',
		value: 'create',
		name: 'Create',
		action: 'Create a debtor',
		description: 'Create a debtor account',
		path: '/settings/add/debtor',
		fields: [
			f.str('name', 'Name', 'Name of the debtor', true),
			f.str('postingaccount_number', 'Posting Account Number', 'If empty, the next free number is used'),
			...addressFields('new', 'debtor', true),
		],
	},
	{
		resource: 'debtor',
		value: 'createBatch',
		name: 'Create Many (Batch)',
		action: 'Create many debtors',
		description: 'Create multiple debtor accounts in one request',
		path: '/settings/add-batch/debtors',
		fields: [
			{
				key: 'debtors',
				label: 'Debtors (JSON)',
				type: 'json',
				required: true,
				default: '[\n  { "name": "Kunde GmbH", "city": "Leipzig", "country": "DE" }\n]',
				description: 'Array of debtor objects with the same fields as "Create"',
			},
		],
	},
	{
		resource: 'debtor',
		value: 'getMany',
		name: 'Get Many',
		action: 'Get many debtors',
		description: 'List all debtors',
		path: '/settings/get/debtors',
		list: { pageSize: 500, paginated: true },
		fields: [],
	},
	{
		resource: 'debtor',
		value: 'update',
		name: 'Update',
		action: 'Update a debtor',
		description: 'Update a debtor account',
		path: '/settings/update/debtor',
		fields: [
			f.int('postingaccount_number', 'Posting Account Number', 'Posting account number of the debtor', true),
			f.str('name', 'Name', 'New name'),
			...addressFields('update', 'debtor', true),
		],
	},

	// ── Creditor ──────────────────────────────────────────────
	{
		resource: 'creditor',
		value: 'create',
		name: 'Create',
		action: 'Create a creditor',
		description: 'Create a creditor account',
		path: '/settings/add/creditor',
		fields: [
			f.str('name', 'Name', 'Name of the creditor', true),
			f.str('postingaccount_number', 'Posting Account Number', 'If empty, the next free number is used'),
			...addressFields('new', 'creditor', false),
			f.int('due_in_days', 'Due in Days', 'Default payment term in days'),
		],
	},
	{
		resource: 'creditor',
		value: 'createBatch',
		name: 'Create Many (Batch)',
		action: 'Create many creditors',
		description: 'Create multiple creditor accounts in one request',
		path: '/settings/add-batch/creditors',
		fields: [
			{
				key: 'creditors',
				label: 'Creditors (JSON)',
				type: 'json',
				required: true,
				default: '[\n  { "name": "Lieferant GmbH", "city": "Berlin", "country": "DE", "due_in_days": 14 }\n]',
				description: 'Array of creditor objects with the same fields as "Create"',
			},
		],
	},
	{
		resource: 'creditor',
		value: 'getMany',
		name: 'Get Many',
		action: 'Get many creditors',
		description: 'List all creditors',
		path: '/settings/get/creditors',
		list: { pageSize: 500, paginated: true },
		fields: [],
	},
	{
		resource: 'creditor',
		value: 'update',
		name: 'Update',
		action: 'Update a creditor',
		description: 'Update a creditor account',
		path: '/settings/update/creditor',
		fields: [
			f.int('postingaccount_number', 'Posting Account Number', 'Posting account number of the creditor', true),
			f.str('name', 'Name', 'New name'),
			...addressFields('update', 'creditor', false),
			f.int('due_in_days', 'Due in Days', 'Default payment term in days'),
		],
	},

	// ── Posting Account ───────────────────────────────────────
	{
		resource: 'postingAccount',
		value: 'create',
		name: 'Create',
		action: 'Create a posting account',
		description: 'Create an individual posting account',
		path: '/settings/add/postingaccount',
		fields: [
			f.str('name', 'Name', 'Name of the posting account', true),
			f.int('postingaccount_number', 'Posting Account Number', 'Number of the new posting account', true),
			f.int('parent_postingaccount_number', 'Parent Posting Account Number', 'Account whose properties are inherited', true),
		],
	},
	{
		resource: 'postingAccount',
		value: 'getMany',
		name: 'Get Many',
		action: 'Get many posting accounts',
		description: 'List posting accounts (incl. accounts, creditors, debtors unless excluded).',
		path: '/settings/get/postingaccounts',
		list: { pageSize: 1000, paginated: true },
		fields: [
			{
				key: 'order',
				label: 'Order',
				type: 'options',
				default: 'postingaccount_number ASC',
				description: 'Sort order',
				options: [
					{ name: 'Name ASC', value: 'name ASC' },
					{ name: 'Name DESC', value: 'name DESC' },
					{ name: 'Number ASC', value: 'postingaccount_number ASC' },
					{ name: 'Number DESC', value: 'postingaccount_number DESC' },
					{ name: 'Type ASC', value: 'type ASC' },
					{ name: 'Type DESC', value: 'type DESC' },
				],
			},
			f.bool('exclude_postingaccounts', 'Exclude Posting Accounts', 'Whether to exclude regular posting accounts'),
			f.bool('exclude_accounts', 'Exclude Base Accounts', 'Whether to exclude base accounts (e.g. bank accounts)'),
			f.bool('exclude_creditors', 'Exclude Creditors', 'Whether to exclude creditor accounts'),
			f.bool('exclude_debtors', 'Exclude Debtors', 'Whether to exclude debtor accounts'),
		],
	},
	{
		resource: 'postingAccount',
		value: 'update',
		name: 'Update',
		action: 'Update a posting account',
		description: 'Rename a posting account',
		path: '/settings/update/postingaccount',
		fields: [
			f.int('postingaccount_number', 'Posting Account Number', 'Number of the posting account', true),
			f.str('name', 'Name', 'New name', true),
		],
	},

	// ── Account (Basiskonto) ──────────────────────────────────
	{
		resource: 'account',
		value: 'getMany',
		name: 'Get Many',
		action: 'Get many accounts',
		description: 'List all base/payment accounts',
		path: '/accounts/get',
		list: { pageSize: 0, paginated: false },
		fields: [],
	},
	{
		resource: 'account',
		value: 'create',
		name: 'Create',
		action: 'Create an account',
		description: 'Add a base account (cash, bank, other)',
		path: '/accounts/add',
		fields: [
			{
				key: 'type',
				label: 'Type',
				type: 'options',
				required: true,
				default: 'bank/institution',
				description: 'Type of the base account',
				options: [
					{ name: 'Bank/Institution', value: 'bank/institution' },
					{ name: 'Cash (Kasse)', value: 'cash' },
					{ name: 'Other', value: 'other' },
				],
			},
			f.str('name', 'Name', 'Name of the account', true),
			f.int('postingaccount_number', 'Posting Account Number', 'Posting account number, e.g. 1210', true),
			f.bool('receipt_creates_transaction', 'Receipt Creates Transaction', 'Whether an assigned receipt automatically creates a transaction'),
			f.bool('is_revision_safe', 'Revision Safe', 'Whether a cash account is revision-safe (only for cash accounts)'),
		],
	},
	{
		resource: 'account',
		value: 'update',
		name: 'Update',
		action: 'Update an account',
		description: 'Update a base account',
		path: '/accounts/update',
		fields: [
			f.int('postingaccount_number', 'Posting Account Number', 'Posting account number of the account', true),
			f.str('name', 'Name', 'New name'),
			f.bool('receipt_creates_transaction', 'Receipt Creates Transaction', 'Whether an assigned receipt automatically creates a transaction (manual accounts only)'),
			f.bool('is_disabled_in_select', 'Hidden in Selection', 'Whether to hide the account in the account dropdown'),
		],
	},
	{
		resource: 'account',
		value: 'delete',
		name: 'Delete',
		action: 'Delete an account',
		description: 'Delete a base account without confirmed postings',
		path: '/accounts/delete',
		fields: [f.int('postingaccount_number', 'Posting Account Number', 'Posting account number of the account', true)],
	},

	// ── Comment ───────────────────────────────────────────────
	{
		resource: 'comment',
		value: 'create',
		name: 'Create',
		action: 'Create a comment',
		description: 'Add a comment to a receipt or transaction',
		path: '/comments/add',
		fields: [
			f.str('comment_text', 'Comment', 'Comment text (2–210 characters)', true),
			f.int('receipt_id_by_customer', 'Receipt ID', 'Set either Receipt ID or Transaction ID'),
			f.int('transaction_id_by_customer', 'Transaction ID', 'Set either Receipt ID or Transaction ID'),
		],
	},

	// ── Cost Location ─────────────────────────────────────────
	{
		resource: 'costLocation',
		value: 'getMany',
		name: 'Get Many',
		action: 'Get many cost locations',
		description: 'List cost locations',
		path: '/cost-locations/get',
		list: { pageSize: 1000, paginated: true },
		fields: [f.str('code', 'Code', 'Return only the cost location with this code')],
	},
	{
		resource: 'costLocation',
		value: 'create',
		name: 'Create',
		action: 'Create a cost location',
		description: 'Add a cost location',
		path: '/cost-locations/add',
		fields: [
			f.str('code', 'Code', 'Alphanumeric code (max. 10 characters)', true),
			f.str('name', 'Name', 'Name/description', true),
		],
	},
	{
		resource: 'costLocation',
		value: 'update',
		name: 'Update',
		action: 'Update a cost location',
		description: "Update a cost location's name",
		path: '/cost-locations/update',
		fields: [
			f.str('code', 'Code', 'Cost location code', true),
			f.str('name', 'Name', 'New name/description', true),
		],
	},
	{
		resource: 'costLocation',
		value: 'delete',
		name: 'Delete',
		action: 'Delete a cost location',
		description: 'Delete a cost location',
		path: '/cost-locations/delete',
		fields: [f.str('code', 'Code', 'Cost location code', true)],
	},

	// ── Report ────────────────────────────────────────────────
	{
		resource: 'report',
		value: 'createBwa',
		name: 'Create BWA',
		action: 'Create a BWA report',
		description: 'Trigger the asynchronous creation of a BWA (Betriebswirtschaftliche Auswertung)',
		path: '/reports/create/bwa',
		fields: [
			f.date('date_from', 'Date From', 'First day of the period', true),
			f.date('date_to', 'Date To', 'Last day of the period', true),
		],
	},
	{
		resource: 'report',
		value: 'createSums',
		name: 'Create Sums Report',
		action: 'Create a sums report',
		description: 'Trigger the asynchronous creation of a Summen- und Saldenliste',
		path: '/reports/create/sums',
		fields: [
			f.date('date_from', 'Date From', 'First day of the period', true),
			f.date('date_to', 'Date To', 'Last day of the period', true),
			{ key: 'base', label: 'Date Base', type: 'options', default: 'date', options: REPORT_BASE, description: 'Date by which postings are considered' },
			f.bool('file_pdf', 'Create PDF', 'Whether to additionally create a PDF file'),
			f.bool('file_csv', 'Create CSV', 'Whether to additionally create a CSV file'),
			f.bool('archive_export', 'Create ZIP Archive', 'Whether to create a ZIP with CSV and ledgers (Kontenblätter)'),
		],
	},
	{
		resource: 'report',
		value: 'getBwa',
		name: 'Get BWA',
		action: 'Get a BWA report',
		description: 'Get a previously created BWA report',
		path: '/reports/get/bwa',
		special: ['reportFiles'],
		fields: [f.int('report_id_by_customer', 'Report ID', 'ID returned by "Create BWA"', true)],
	},
	{
		resource: 'report',
		value: 'getSums',
		name: 'Get Sums Report',
		action: 'Get a sums report',
		description: 'Get a previously created Summen- und Saldenliste',
		path: '/reports/get/sums',
		special: ['reportFiles'],
		fields: [f.int('report_id_by_customer', 'Report ID', 'ID returned by "Create Sums Report"', true)],
	},
	{
		resource: 'report',
		value: 'getLedger',
		name: 'Get Ledger',
		action: 'Get a posting account ledger',
		description: 'Get the ledger (Kontenblatt) of one posting account for a period',
		path: '/reports/get/sums/ledger',
		fields: [
			f.int('postingaccount_number', 'Posting Account Number', 'Posting account number', true),
			f.date('date_from', 'Date From', 'First day of the period', true),
			f.date('date_to', 'Date To', 'Last day of the period', true),
			{ key: 'base', label: 'Date Base', type: 'options', default: 'date', options: REPORT_BASE, description: 'Date by which postings are considered' },
		],
	},
];

export function findOperation(resource: string, operation: string): OperationDef | undefined {
	return OPERATIONS.find((o) => o.resource === resource && o.value === operation);
}
