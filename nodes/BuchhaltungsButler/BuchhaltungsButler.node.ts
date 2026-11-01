import type {
	IBinaryKeyData,
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

import { nodeProperties } from './descriptions';
import {
	bbApiRequest,
	bbApiRequestAllItems,
	formatDate,
	formatDateTime,
	mimeTypeFor,
	toArray,
} from './GenericFunctions';
import type { FieldDef, OperationDef } from './operations';
import { findOperation } from './operations';

function convertValue(
	ctx: IExecuteFunctions,
	field: FieldDef,
	value: unknown,
	itemIndex: number,
): unknown {
	switch (field.type) {
		case 'date':
			return formatDate(value);
		case 'datetime':
			return formatDateTime(value);
		case 'number':
			return typeof value === 'number' ? value : Number(value);
		case 'boolean':
			return Boolean(value);
		case 'json': {
			let parsed: unknown = value;
			if (typeof value === 'string') {
				try {
					parsed = JSON.parse(value);
				} catch {
					throw new NodeOperationError(ctx.getNode(), `"${field.label}" is not valid JSON`, { itemIndex });
				}
			}
			if (!Array.isArray(parsed)) {
				throw new NodeOperationError(ctx.getNode(), `"${field.label}" must be a JSON array`, {
					itemIndex,
				});
			}
			if (field.maxItems && parsed.length > field.maxItems) {
				throw new NodeOperationError(
					ctx.getNode(),
					`"${field.label}" contains ${parsed.length} entries, the API accepts at most ${field.maxItems}`,
					{ itemIndex, description: 'Split the data into chunks, e.g. with a Loop Over Items node' },
				);
			}
			return parsed;
		}
		case 'options':
			// account numbers from load options arrive as strings but the API expects integers
			if (field.loadOptionsMethod && typeof value === 'string' && /^\d+$/.test(value)) {
				return Number(value);
			}
			return value;
		default:
			return value;
	}
}

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

function buildBody(ctx: IExecuteFunctions, op: OperationDef, i: number): IDataObject {
	const body: IDataObject = {};

	for (const field of op.fields.filter((x) => x.required)) {
		const raw = ctx.getNodeParameter(field.key, i);
		// invoice_number is required but may legitimately be empty
		if (isEmpty(raw) && field.type !== 'string') {
			throw new NodeOperationError(ctx.getNode(), `"${field.label}" is required`, { itemIndex: i });
		}
		body[field.key] = convertValue(ctx, field, raw, i) as IDataObject[keyof IDataObject];
	}

	const optional = op.fields.filter((x) => !x.required);
	if (optional.length) {
		const collection = ctx.getNodeParameter(op.list ? 'filters' : 'additionalFields', i, {}) as IDataObject;
		for (const [key, raw] of Object.entries(collection)) {
			const field = optional.find((x) => x.key === key);
			if (!field || isEmpty(raw)) continue;
			body[key] = convertValue(ctx, field, raw, i) as IDataObject[keyof IDataObject];
		}
	}

	const special = op.special ?? [];

	if (special.includes('invoiceItems') || special.includes('eInvoiceItems')) {
		const items = ((ctx.getNodeParameter('items', i, {}) as IDataObject).item ?? []) as IDataObject[];
		if (!items.length) {
			throw new NodeOperationError(ctx.getNode(), 'At least one invoice item is required', { itemIndex: i });
		}
		body.item_name = items.map((x) => String(x.name ?? ''));
		body.item_amount = items.map((x) => String(x.amount ?? 1));
		body.item_unit = items.map((x) => String(x.unit ?? ''));
		body.item_single_price = items.map((x) => String(x.singlePrice ?? 0));
		if (items.some((x) => !isEmpty(x.description))) {
			body.item_description = items.map((x) => String(x.description ?? ''));
		}
		if (special.includes('eInvoiceItems')) {
			body.item_tax_type = items.map((x) => String(x.taxType ?? 'S'));
			body.item_tax_amount = items.map((x) => (x.taxType === 'S' || x.taxType === undefined ? String(x.taxAmount ?? 19) : '0'));
		} else {
			body.item_vat = items.map((x) => String(x.vat ?? 19));
		}
	}

	if (special.includes('postingLinesReceipt') || special.includes('postingLinesTransaction')) {
		const lines = ((ctx.getNodeParameter('postingLines', i, {}) as IDataObject).line ?? []) as IDataObject[];
		if (!lines.length) {
			throw new NodeOperationError(ctx.getNode(), 'At least one posting line is required', { itemIndex: i });
		}
		body.postingaccounts = lines.map((x) => Number(x.postingAccount));
		body.postingtexts = lines.map((x) => String(x.postingText ?? ''));
		body.vats = lines.map((x) => String(x.vat));
		body.amounts = lines.map((x) => Number(x.amount ?? 0).toFixed(2));
		if (lines.some((x) => !isEmpty(x.costLocation))) {
			body.cost_locations = lines.map((x) => String(x.costLocation ?? ''));
		}
		if (lines.some((x) => !isEmpty(x.costLocationTwo))) {
			body.cost_locations_two = lines.map((x) => String(x.costLocationTwo ?? ''));
		}
		if (lines.some((x) => !isEmpty(x.ossOriginCountry) || !isEmpty(x.ossDestinationCountry) || !isEmpty(x.ossVatRate))) {
			body.oss_origin_countries = lines.map((x) => (isEmpty(x.ossOriginCountry) ? null : String(x.ossOriginCountry)));
			body.oss_destination_countries = lines.map((x) =>
				isEmpty(x.ossDestinationCountry) ? null : String(x.ossDestinationCountry),
			);
			body.oss_vat_rates = lines.map((x) => (isEmpty(x.ossVatRate) ? null : String(x.ossVatRate)));
		}
		if (special.includes('postingLinesTransaction')) {
			// must be a parallel array (one entry per line, null = no receipt)
			body.oi_receipts_ids_by_customer = lines.map((x) =>
				x.openItemReceiptId && Number(x.openItemReceiptId) > 0 ? Number(x.openItemReceiptId) : null,
			);
		}
	}

	if (special.includes('receiptOrder')) {
		const rules = ((ctx.getNodeParameter('sort', i, {}) as IDataObject).rule ?? []) as IDataObject[];
		if (rules.length) {
			const order: IDataObject = {};
			for (const rule of rules) order[String(rule.field)] = String(rule.direction);
			body.order = order;
		}
	}

	return body;
}

export class BuchhaltungsButler implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'BuchhaltungsButler',
		name: 'buchhaltungsButler',
		icon: { light: 'file:buchhaltungsbutler.svg', dark: 'file:buchhaltungsbutler.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Belege, Umsätze, Rechnungen, Buchungen, Stammdaten und Auswertungen in BuchhaltungsButler',
		defaults: { name: 'BuchhaltungsButler' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'buchhaltungsButlerApi', required: true }],
		properties: nodeProperties,
	};

	methods = {
		loadOptions: {
			async getPaymentAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await bbApiRequest.call(this, '/accounts/get', {});
				return toArray(response.data)
					.map((a) => ({
						name: `${String(a.postingaccount_number)} – ${String(a.name)}`,
						value: String(a.postingaccount_number),
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		let lastCallAt = 0;

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const op = findOperation(resource, operation);
				if (!op) {
					throw new NodeOperationError(this.getNode(), `Unsupported operation "${resource}/${operation}"`, {
						itemIndex: i,
					});
				}

				// respect documented per-endpoint rate limits between consecutive items
				if (op.throttleMs && lastCallAt) {
					const wait = op.throttleMs - (Date.now() - lastCallAt);
					if (wait > 0) await sleep(wait);
				}

				let path = op.path;
				if (op.idInPath) {
					const id = this.getNodeParameter('idByCustomer', i) as number;
					if (!id) {
						throw new NodeOperationError(this.getNode(), `"${op.idInPath.label}" is required`, {
							itemIndex: i,
						});
					}
					// the spec's literal "/id_by_customer" segment is replaced by the id (e.g. /receipts/get/16)
					path = path.replace(/\/id_by_customer$/, `/${id}`);
				}

				const body = buildBody(this, op, i);
				const special = op.special ?? [];
				const hasFileOptions = special.includes('receiptFile') || special.includes('reportFiles');
				const options = hasFileOptions ? (this.getNodeParameter('options', i, {}) as IDataObject) : {};

				// ── upload: binary → base64 + file_name ──
				if (special.includes('upload')) {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
					const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
					body.file = buffer.toString('base64');
					if (isEmpty(body.file_name)) {
						body.file_name = binaryData.fileName ?? `beleg.${binaryData.fileExtension ?? 'pdf'}`;
					}
				}
				if (special.includes('receiptFile') && options.download) body.get_file = true;
				if (special.includes('reportFiles') && options.download) body.get_files = true;

				// ── list endpoints ──
				if (op.list) {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
					let rows: IDataObject[];
					if (op.list.paginated) {
						rows = await bbApiRequestAllItems.call(this, path, body, op.list.pageSize, limit);
					} else {
						const response = await bbApiRequest.call(this, path, body);
						rows = toArray(response.data);
						if (limit !== undefined) rows = rows.slice(0, limit);
					}
					lastCallAt = Date.now();
					returnData.push(
						...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(rows), {
							itemData: { item: i },
						}),
					);
					continue;
				}

				const response = await bbApiRequest.call(this, path, body);
				lastCallAt = Date.now();

				// ── single receipt / transaction: unwrap `data` ──
				let json: IDataObject = response;
				if (op.idInPath && op.value === 'get' && response.data && typeof response.data === 'object') {
					json = (Array.isArray(response.data) ? response.data[0] : response.data) as IDataObject;
				}

				const binary: IBinaryKeyData = {};
				const binaryPropertyName = String(options.binaryPropertyName || 'data');

				if (special.includes('receiptFile') && options.download && json.file_content) {
					const ext = String(json.file_type || 'pdf');
					const fileName = `${String(json.filename || `beleg_${String(json.id_by_customer ?? '')}`)}.${ext}`;
					binary[binaryPropertyName] = await this.helpers.prepareBinaryData(
						Buffer.from(String(json.file_content), 'base64'),
						fileName,
						mimeTypeFor(ext),
					);
					json = { ...json };
					delete json.file_content;
				}

				if (special.includes('reportFiles') && options.download && response.files) {
					const files = response.files as IDataObject;
					const extByKey: Record<string, string> = { pdf: 'pdf', csv: 'csv', csv_archive: 'zip' };
					for (const [key, content] of Object.entries(files)) {
						if (!content) continue;
						const ext = extByKey[key] ?? 'bin';
						binary[`${binaryPropertyName}_${key}`] = await this.helpers.prepareBinaryData(
							Buffer.from(String(content), 'base64'),
							`${op.value === 'getBwa' ? 'bwa' : 'susa'}_${String(body.report_id_by_customer)}.${ext}`,
							mimeTypeFor(ext),
						);
					}
					json = { ...json };
					delete json.files;
				}

				const out: INodeExecutionData = { json, pairedItem: { item: i } };
				if (Object.keys(binary).length) out.binary = binary;
				returnData.push(out);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), (error.cause ?? {}) as JsonObject, {
						message: error.message,
						description: error.description ?? undefined,
						httpCode: error.httpCode ?? undefined,
						itemIndex: i,
					});
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
					description: (error as NodeOperationError).description ?? undefined,
				});
			}
		}

		return [returnData];
	}
}
