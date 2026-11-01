import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import type { FieldDef, OperationDef } from './operations';
import { E_INVOICE_TAX_TYPES, OPERATIONS, RESOURCES, VAT_KEYS } from './operations';

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

function show(op: OperationDef, extra: Record<string, unknown[]> = {}) {
	return { show: { resource: [op.resource], operation: [op.value], ...extra } };
}

function fieldToProperty(field: FieldDef, inCollection: boolean): INodeProperties {
	const base: Partial<INodeProperties> = {
		displayName: field.label,
		name: field.key,
		description: field.description,
	};
	if (!inCollection && field.required) base.required = true;
	if (field.placeholder) base.placeholder = field.placeholder;

	switch (field.type) {
		case 'number':
			return { ...base, type: 'number', default: field.default ?? 0 } as INodeProperties;
		case 'boolean':
			return { ...base, type: 'boolean', default: field.default ?? false } as INodeProperties;
		case 'date':
		case 'datetime':
			return { ...base, type: 'dateTime', default: '' } as INodeProperties;
		case 'json':
			return { ...base, type: 'json', default: field.default ?? '[]' } as INodeProperties;
		case 'options':
			if (field.loadOptionsMethod) {
				return {
					...base,
					type: 'options',
					typeOptions: { loadOptionsMethod: field.loadOptionsMethod },
					default: '',
				} as INodeProperties;
			}
			return {
				...base,
				type: 'options',
				options: (field.options ?? []).map((o) => ({ ...o })),
				default: field.default ?? field.options?.[0]?.value ?? '',
			} as INodeProperties;
		default:
			return { ...base, type: 'string', default: field.default ?? '' } as INodeProperties;
	}
}

const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [...RESOURCES].sort(byName).map((r) => ({ name: r.name, value: r.value })),
	default: 'receipt',
};

function operationProperties(): INodeProperties[] {
	return RESOURCES.map((resource) => {
		const ops = OPERATIONS.filter((o) => o.resource === resource.value);
		const options: INodePropertyOptions[] = ops
			.map((o) => ({ name: o.name, value: o.value, action: o.action, description: o.description }))
			.sort(byName);
		const property: INodeProperties = {
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: { resource: [resource.value] } },
			options,
			default: '',
		};
		property.default = ops.find((o) => o.value === 'getMany')?.value ?? ops[0].value;
		return property;
	});
}

function invoiceItemsProperty(op: OperationDef, eInvoice: boolean): INodeProperties {
	const taxValues: INodeProperties[] = eInvoice
		? [
				{
					displayName: 'Tax Type',
					name: 'taxType',
					type: 'options',
					options: E_INVOICE_TAX_TYPES,
					default: 'S',
					description: 'E-invoice tax category of the item',
				},
				{
					displayName: 'VAT Rate',
					name: 'taxAmount',
					type: 'number',
					default: 19,
					description: 'VAT rate in percent, only used for tax type S',
				},
			]
		: [
				{
					displayName: 'VAT Rate',
					name: 'vat',
					type: 'number',
					default: 19,
					description: 'VAT rate in percent (0–100)',
				},
			];

	const itemValues: INodeProperties[] = [
		{ displayName: 'Name', name: 'name', type: 'string', default: '', required: true },
		{
			displayName: 'Description',
			name: 'description',
			type: 'string',
			default: '',
			typeOptions: { rows: 2 },
		},
		{
			displayName: 'Quantity',
			name: 'amount',
			type: 'number',
			default: 1,
			typeOptions: { numberPrecision: 4 },
		},
		{
			displayName: 'Unit',
			name: 'unit',
			type: 'string',
			default: 'Stk.',
			description: 'E.g. Stk., Std., Pauschal.',
		},
		{
			displayName: 'Unit Price',
			name: 'singlePrice',
			type: 'number',
			default: 0,
			typeOptions: { numberPrecision: 2 },
			description: "Net or gross depending on 'Show Prices'",
		},
		...taxValues,
	];

	return {
		displayName: 'Items',
		name: 'items',
		type: 'fixedCollection',
		required: true,
		typeOptions: { multipleValues: true, sortable: true },
		placeholder: 'Add Item',
		default: {},
		displayOptions: show(op),
		options: [{ displayName: 'Item', name: 'item', values: itemValues }],
	};
}

function postingLinesProperty(op: OperationDef, withOpenItem: boolean): INodeProperties {
	const values: INodeProperties[] = [
		{
			displayName: 'Posting Account',
			name: 'postingAccount',
			type: 'number',
			default: 0,
			required: true,
			description: 'Posting account number (Sachkonto), e.g. 4930',
		},
		{ displayName: 'Posting Text', name: 'postingText', type: 'string', default: '', required: true },
		{
			displayName: 'VAT Key',
			name: 'vat',
			type: 'options',
			options: VAT_KEYS,
			default: '19_pre',
		},
		{
			displayName: 'Amount',
			name: 'amount',
			type: 'number',
			default: 0,
			typeOptions: { numberPrecision: 2 },
			description: 'Gross amount of this line, sent as 0000.00',
		},
		{ displayName: 'Cost Location', name: 'costLocation', type: 'string', default: '' },
		{ displayName: 'Cost Location Two', name: 'costLocationTwo', type: 'string', default: '' },
		{
			displayName: 'OSS Origin Country',
			name: 'ossOriginCountry',
			type: 'string',
			default: '',
			description: 'ISO 3166-1 alpha-2, only for OSS VAT keys',
		},
		{
			displayName: 'OSS Destination Country',
			name: 'ossDestinationCountry',
			type: 'string',
			default: '',
			description: 'ISO 3166-1 alpha-2, only for OSS VAT keys',
		},
		{
			displayName: 'OSS VAT Rate',
			name: 'ossVatRate',
			type: 'string',
			default: '',
			description: 'Only for OSS VAT keys, e.g. 20.00',
		},
	];
	if (withOpenItem) {
		values.push({
			displayName: 'Open Item Receipt ID',
			name: 'openItemReceiptId',
			type: 'number',
			default: 0,
			description:
				'Receipt (id_by_customer) assigned to this line as open item (OP-Ausgleich). 0 = none. Required only if OI postings are active.',
		});
	}
	return {
		displayName: 'Posting Lines',
		name: 'postingLines',
		type: 'fixedCollection',
		required: true,
		typeOptions: { multipleValues: true, sortable: true },
		placeholder: 'Add Posting Line',
		default: {},
		displayOptions: show(op),
		options: [{ displayName: 'Line', name: 'line', values }],
	};
}

function operationFields(op: OperationDef): INodeProperties[] {
	const props: INodeProperties[] = [];
	const special = op.special ?? [];

	if (op.idInPath) {
		props.push({
			displayName: op.idInPath.label,
			name: 'idByCustomer',
			type: 'number',
			required: true,
			default: 0,
			description: op.idInPath.description,
			displayOptions: show(op),
		});
	}

	if (special.includes('upload')) {
		props.push({
			displayName: 'Input Binary Field',
			name: 'binaryPropertyName',
			type: 'string',
			default: 'data',
			required: true,
			hint: 'The name of the input binary field containing the file to be uploaded',
			displayOptions: show(op),
		});
	}

	for (const field of op.fields.filter((x) => x.required)) {
		props.push({ ...fieldToProperty(field, false), displayOptions: show(op) });
	}

	if (special.includes('invoiceItems')) props.push(invoiceItemsProperty(op, false));
	if (special.includes('eInvoiceItems')) props.push(invoiceItemsProperty(op, true));
	if (special.includes('postingLinesReceipt')) props.push(postingLinesProperty(op, false));
	if (special.includes('postingLinesTransaction')) props.push(postingLinesProperty(op, true));

	if (op.list) {
		props.push(
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: show(op),
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 50,
				description: 'Max number of results to return',
				displayOptions: show(op, { returnAll: [false] }),
			},
		);
	}

	const optional = op.fields.filter((x) => !x.required);
	if (optional.length) {
		props.push({
			displayName: op.list ? 'Filters' : 'Additional Fields',
			name: op.list ? 'filters' : 'additionalFields',
			type: 'collection',
			placeholder: op.list ? 'Add Filter' : 'Add Field',
			default: {},
			displayOptions: show(op),
			options: optional.map((x) => fieldToProperty(x, true)).sort((a, b) => a.displayName.localeCompare(b.displayName)),
		});
	}

	if (special.includes('receiptOrder')) {
		props.push({
			displayName: 'Sort',
			name: 'sort',
			type: 'fixedCollection',
			typeOptions: { multipleValues: true, sortable: true },
			placeholder: 'Add Sort Rule',
			default: {},
			displayOptions: show(op),
			options: [
				{
					displayName: 'Rule',
					name: 'rule',
					values: [
						{
							displayName: 'Field',
							name: 'field',
							type: 'options',
							default: 'date',
							options: [
								{ name: 'Amount', value: 'amount' },
								{ name: 'Counterparty', value: 'invoicingparty' },
								{ name: 'Date', value: 'date' },
								{ name: 'Invoice Number', value: 'invoicenumber' },
							],
						},
						{
							displayName: 'Direction',
							name: 'direction',
							type: 'options',
							default: 'DESC',
							options: [
								{ name: 'Ascending', value: 'ASC' },
								{ name: 'Descending', value: 'DESC' },
							],
						},
					],
				},
			],
		});
	}

	if (special.includes('receiptFile') || special.includes('reportFiles')) {
		const isReport = special.includes('reportFiles');
		props.push({
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions: show(op),
			options: [
				{
					displayName: isReport ? 'Download Files' : 'Download File',
					name: 'download',
					type: 'boolean',
					default: false,
					description: isReport
						? 'Whether to fetch the report files (PDF/CSV/ZIP) and output them as binary data'
						: 'Whether to fetch the receipt file (PDF/ZUGFeRD/XRechnung) and output it as binary data',
				},
				{
					displayName: 'Put Output File in Field',
					name: 'binaryPropertyName',
					type: 'string',
					default: 'data',
					hint: isReport
						? 'Prefix for the output binary fields (e.g. data_pdf, data_csv, data_csv_archive)'
						: 'The name of the output binary field to put the file in',
				},
			],
		});
	}

	return props;
}

export const nodeProperties: INodeProperties[] = [
	resourceProperty,
	...operationProperties(),
	...OPERATIONS.flatMap(operationFields),
];
