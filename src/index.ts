import { parse } from 'cookie';

interface TumblrBotEnv {
	TUMBLR_CONSUMER_KEY: string;
	TUMBLR_CONSUMER_SECRET: string;
}

interface TumblrToken {
	error?: string;
	error_description?: string;
	access_token?: string;
	token_type?: string;
	expires_in?: number;
	refresh_token?: string;
	scope?: string;
}

//TODO: Improve this by making it a separate file or something
const htmlHead = `
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="X-UA-Compatible" content="IE=edge" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<!--Credit for modified style: https://github.com/KeenRivals/bestmotherfucking.website-->
		<style>
			@media (prefers-color-scheme: dark) {
				body {
					color: #fff;
					background: #000;
				}
				a:link {
					color: #cdf;
				}
				a:hover,
				a:visited:hover {
					color: #def;
				}
				a:visited {
					color: #dcf;
				}
			}
			body {
				margin: 1em auto;
				max-width: 40em;
				padding: 0 0.62em;
				font: 1.2em/1.62 sans-serif;
			}
			h1,
			h2,
			h3 {
				line-height: 1.2;
				text-align: center;
			}
			@media print {
				body {
					max-width: none;
				}
			}
		</style>
		<title>Tumblr Botkill</title>
	</head>
	<body>
		<h1>Tumblr Botkill</h1>
`;
const htmlTail = '</body></html>';

export default {
	async fetch(request: Request, env: TumblrBotEnv, ctx: Object) {
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/': {
				return Response.redirect('https://github.com/MarkSuckerberg/tumblr-botkill');
			}
			case '/auth': {
				return await this.auth(request, env);
			}
			default: {
				return new Response('Not found', {
					status: 404,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type',
					},
				});
			}
		}
	},

	async auth(request: Request, env: TumblrBotEnv): Promise<Response> {
		const consumerID = env.TUMBLR_CONSUMER_KEY;
		const consumerSecret = env.TUMBLR_CONSUMER_SECRET;
		const url = new URL(request.url);
		const code = url.searchParams.get('code');
		const write = url.searchParams.get('write');
		const paramState = url.searchParams.get('state');
		const cookieState = parse(request.headers.get('Cookie') || '')['__Host-state'];

		// If the request doesn't have a code, someone is trying to start the auth process
		if (code == undefined) {
			return await this.authRedirect(url.origin + url.pathname, consumerID);
		}
		//Ensure that the state param and the state cookie match
		else if (paramState === cookieState) {
			return await this.handleCallback(url.origin + url.pathname, consumerID, consumerSecret, code);
		}
		return new Response('Invalid state', { status: 400 });
	},

	async authRedirect(redirectURI: string, consumerID: string): Promise<Response> {
		const state = crypto.getRandomValues(new Uint32Array(1))[0].toString();
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: consumerID,
			redirect_uri: redirectURI,
			scope: 'basic',
			approval_prompt: 'auto',
			state: state,
		});

		const writeParams = new URLSearchParams(params);
		writeParams.set('scope', 'basic write');

		return new Response(
			htmlHead +
				`<a href=https://www.tumblr.com/oauth2/authorize?${params.toString()}>Login with Tumblr</a> - Lists bots (Doesn't block anyone, just lists.)<br>` +
				`<a href=https://www.tumblr.com/oauth2/authorize?${writeParams.toString()}>Login with Tumblr (Write access)</a> - Blocks bots (Use at your own risk!)` +
				htmlTail,
			{
				status: 200,
				headers: {
					'Content-Type': 'text/html',
					'Set-Cookie': `__Host-state=${state}; path=/; secure; HttpOnly; SameSite=Lax`,
				},
			}
		);
	},

	async handleCallback(
		redirectUri: string,
		consumerID: string,
		consumerSecret: string,
		authCode: string
	): Promise<Response> {
		const request = await fetch('https://api.tumblr.com/v2/oauth2/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'User-Agent': 'TumblrBotKill/0.0.1',
			},
			body: JSON.stringify({
				grant_type: 'authorization_code',
				client_id: consumerID,
				client_secret: consumerSecret,
				redirect_uri: redirectUri,
				code: authCode,
			}),
		});

		const token: TumblrToken = await request.json();

		if (token.error) {
			return new Response(token.error_description, {
				status: 400,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		return await this.getTumblrFollowers(
			token.access_token!,
			consumerID,
			token.scope!.includes('write')
		);
	},

	async getTumblrFollowers(
		token: string,
		consumerID: string,
		writeAccess: boolean
	): Promise<Response> {
		const user: any = await this.accessTumblrAPI(token, 'user/info');

		const allFollowers: any[] = new Array();

		//Tumblr limits the number of followers returned to 20 at a time, so we need to loop through all of them
		for (let page = 0; true; page++) {
			//Get the followers
			const followersResponse: any = await this.accessTumblrAPI(
				token,
				`blog/${user.user.name}/followers?offset=${page * 20}`
			);
			const followersPartial = followersResponse.users;
			allFollowers.push(...followersPartial);
			//If we got less than 20 followers, we've reached the end
			if (followersPartial.length !== 20) {
				break;
			}
		}

		//If we have write access, block all of the followers returned that seem like bots
		if (writeAccess) {
			await this.accessTumblrAPI(token, `blog/${user.user.name}/blocks/bulk`, {
				blocked_tumblelogs: allFollowers
					.filter(blog => !blog.following && blog.updated === 0)
					.map(blog => blog.name)
					.join(','),
			});
		}

		//Show the list of followers that seem like bots to the user
		return new Response(
			htmlHead +
				allFollowers
					.filter(blog => !blog.following && blog.updated === 0)
					.map(blog => `<li><a href="https://${blog.name}.tumblr.com">${blog.name}</a></li>`)
					.join('')
					.concat(
						writeAccess
							? '<h2>Bot Accounts listed above blocked.</h2>'
							: '<h2><a href="/auth">Return to start to actually block the bots</a></h2>'
					) +
				htmlTail,
			{
				status: 200,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
					'Content-Type': 'text/html',
				},
			}
		);
	},

	async accessTumblrAPI(
		token: string,
		endpoint: string,
		query?: Record<string, string>
	): Promise<JSON> {
		const request = await fetch(`https://api.tumblr.com/v2/${endpoint}`, {
			method: query ? 'POST' : 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'User-Agent': 'TumblrBotKill/0.0.1',
				'Authorization': `Bearer ${token}`,
			},
			body: JSON.stringify(query),
		});

		const response: any = await request.json();
		return response.response;
	},
};
