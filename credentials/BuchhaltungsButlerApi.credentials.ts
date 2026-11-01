import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class BuchhaltungsButlerApi implements ICredentialType {
	name = 'buchhaltungsButlerApi';

	displayName = 'BuchhaltungsButler API';

	icon: Icon = {
		light: 'file:../nodes/BuchhaltungsButler/buchhaltungsbutler.svg',
		dark: 'file:../nodes/BuchhaltungsButler/buchhaltungsbutler.dark.svg',
	};

	documentationUrl = 'https://app.buchhaltungsbutler.de/docs/api/v1/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Client',
			name: 'apiClient',
			type: 'string',
			default: '',
			required: true,
			description:
				'Global API client (HTTP Basic Auth username). BuchhaltungsButler → Einstellungen → Schnittstellen und API-Zugang.',
		},
		{
			displayName: 'API Secret',
			name: 'apiSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Global API secret (HTTP Basic Auth password)',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'API key of the customer account (Mandant) the requests act on. Sent as "api_key" in every request body.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://webapp.buchhaltungsbutler.de/api/v1',
			description: 'Only change this if BuchhaltungsButler tells you to use a different endpoint',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.apiClient}}',
				password: '={{$credentials.apiSecret}}',
			},
			body: {
				api_key: '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/accounts/get',
			method: 'POST',
			json: true,
			body: {},
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'success',
					value: false,
					message: 'BuchhaltungsButler rejected the credentials (check API client, secret and API key)',
				},
			},
		],
	};
}
