import { ironAuthHandler } from 'iron-auth/next';
import type { ResponseTransformer } from 'msw';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import type { NextApiRequest } from 'next';
import { getHttpMock, getJsonResp, getIronAuthOptions } from './request-utils';

const basePath = 'http://localhost';
const basePathApi = `${basePath}/api/auth`;

const handlers = [
  rest.all(`${basePathApi}/:ironauth`, async (req, res, ctx) => {
    const { res: resMock } = getHttpMock();

    const body: string = await req.text();

    const newParams: Partial<Record<string, string>> = {
      ...(req.params as Record<string, string>),
    };
    // eslint-disable-next-line no-restricted-syntax
    for (const [key, value] of req.url.searchParams.entries()) {
      newParams[key] = value;
    }

    const reqMock: NextApiRequest = {
      ...req,
      url: req.url.href,
      method: req.method,
      headers: {
        ...req.headers.all(),
        cookie: req.headers.get('cookie')?.replace(', ', '; ') ?? '',
      },
      query: newParams,
      body,
      cookies: req.cookies,
      json: () => JSON.parse(body),
    } as unknown as NextApiRequest;

    await ironAuthHandler(await getIronAuthOptions(), reqMock, resMock);

    const cookies: ResponseTransformer[] = [];

    (resMock.getHeader('set-cookie') as string[])?.forEach((cookie) => {
      const [name, value] = cookie.split('=');
      if (name && value) {
        const [refinedValue] = value.split(';');

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        cookies.push(ctx.cookie(name, refinedValue!, { path: '/', sameSite: 'lax', secure: true }));
      }
    });

    // eslint-disable-next-line no-underscore-dangle
    const redirectUrl = resMock._getRedirectUrl();

    return res(
      ctx.status(redirectUrl ? 307 : resMock.statusCode),
      redirectUrl ? ctx.set('Location', redirectUrl) : ctx.json(getJsonResp(resMock)),
      ...cookies,
    );
  }),
];

const server = setupServer(...handlers);

export { basePathApi as basePath, server };
