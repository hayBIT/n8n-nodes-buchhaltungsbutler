import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, sleep } from 'n8n-workflow';

type Ctx = IExecuteFunctions | ILoadOptionsFunctions;

const MAX_RATE_LIMIT_RETRIES = 3;

/** Single POST call against the BuchhaltungsButler API v1 (every endpoint is POST + JSON body). */
export async function bbApiRequest(
	this: Ctx,
	path: string,
	body: IDataObject = {},
): Promise<IDataObject> {
	const credentials = await this.getCredentials('buchhaltungsButlerApi');
	const baseUrl = String(credentials.baseUrl || 'https://webapp.buchhaltungsbutler.de/api/v1').replace(
		/\/+$/,
		'',
	);

	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${baseUrl}${path}`,
		body: { ...body, api_key: credentials.apiKey as string },
		json: true,
	};

	for (let attempt = 0; ; attempt++) {
		let response: IDataObject;
		try {
			response = (await this.helpers.httpRequestWithAuthentication.call(
				this,
				'buchhaltungsButlerApi',
				options,
			)) as IDataObject;
		} catch (error) {
			const status = Number(
				(error as JsonObject)?.httpCode ??
					((error as JsonObject)?.response as JsonObject)?.status ??
					(error as JsonObject)?.statusCode,
			);
			if (status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
				await sleep(5000 * (attempt + 1));
				continue;
			}
			if (error instanceof NodeApiError) {
				throw new NodeApiError(this.getNode(), (error.cause ?? {}) as unknown as JsonObject, {
					message: error.message,
					description: error.description ?? undefined,
					httpCode: error.httpCode ?? undefined,
				});
			}

			const responseBody = ((error as JsonObject)?.response as JsonObject)?.body ??
				((error as JsonObject)?.response as JsonObject)?.data ??
				(error as JsonObject)?.cause;
			const bb =
				responseBody && typeof responseBody === 'object' ? (responseBody as IDataObject) : undefined;

			throw new NodeApiError(this.getNode(), error as JsonObject, {
				message: bb?.message
					? `BuchhaltungsButler: ${String(bb.message)}`
					: undefined,
				description: bb
					? `Endpoint ${path}, error_code ${String(bb.error_code ?? '?')}`
					: `Endpoint ${path}`,
				httpCode: Number.isFinite(status) ? String(status) : undefined,
			});
		}

		if (response && typeof response === 'object' && response.success === false) {
			throw new NodeApiError(this.getNode(), response as JsonObject, {
				message: `BuchhaltungsButler: ${String(response.message ?? 'request failed')}`,
				description: `Endpoint ${path}, error_code ${String(response.error_code ?? '?')}`,
			});
		}
		return response;
	}
}

/** Paginates a list endpoint via limit/offset. Returns the concatenated `data` arrays. */
export async function bbApiRequestAllItems(
	this: Ctx,
	path: string,
	body: IDataObject,
	pageSize: number,
	maxItems?: number,
): Promise<IDataObject[]> {
	const results: IDataObject[] = [];
	let offset = Number(body.offset ?? 0);

	while (true) {
		const remaining = maxItems !== undefined ? maxItems - results.length : pageSize;
		const limit = Math.min(pageSize, remaining);
		if (limit <= 0) break;

		const response = await bbApiRequest.call(this, path, { ...body, limit, offset });
		const data = toArray(response.data);
		results.push(...data);

		if (data.length < limit) break;
		offset += data.length;
	}
	return results;
}

export function toArray(value: unknown): IDataObject[] {
	if (Array.isArray(value)) return value as IDataObject[];
	if (value && typeof value === 'object') {
		// some endpoints return objects keyed by id
		const values = Object.values(value as IDataObject);
		if (values.length && values.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
			return values as IDataObject[];
		}
		return [value as IDataObject];
	}
	return [];
}

/** 'YYYY-MM-DD' from a date picker value, ISO string or plain date. */
export function formatDate(value: unknown): string {
	const s = String(value ?? '').trim();
	if (!s) return s;
	const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
	return m ? m[1] : s;
}

/** 'YYYY-MM-DD HH:MM:SS' from a date picker value or ISO string. */
export function formatDateTime(value: unknown): string {
	const s = String(value ?? '').trim();
	if (!s) return s;
	const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
	if (!m) return s;
	if (!m[2]) return `${m[1]} 00:00:00`;
	return `${m[1]} ${m[2]}:${m[3]}:${m[4] ?? '00'}`;
}

export function mimeTypeFor(ext: string): string {
	switch (ext.toLowerCase()) {
		case 'pdf':
			return 'application/pdf';
		case 'xml':
			return 'application/xml';
		case 'csv':
			return 'text/csv';
		case 'zip':
			return 'application/zip';
		default:
			return 'application/octet-stream';
	}
}
