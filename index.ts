import * as iconv from 'iconv-lite'
import Request = Insomnia.Request.Request;

type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const processRequest = () => {

}

const decodeResponse = (context, response): TokenResponse => {
  if (response.statusCode != 200) {
    throw new Error(`Request completed with non-200 error code: ${response.statusCode}`);
  }

  const bodyBuffer = context.util.models.response.getBodyBuffer(response, '');
  const match = response.contentType.match(/charset=([\w-]+)/);
  const charset = match && match.length >= 2 ? match[1] : 'utf-8';

  let output = '';
  // Sometimes iconv conversion fails so fallback to regular buffer
  try {
    output = iconv.decode(bodyBuffer, charset);
  } catch (err) {
    console.warn('[response] Failed to decode body', err);
    output = bodyBuffer.toString();
  }

  return JSON.parse(output);
}

const isOutOfDate = (lastRequest: Date) => {
  if (!lastRequest) {
    return true;
  }
  const now = Date.now();
  console.log(`IsOutOfDate: now: ${now}, lastRequest: ${lastRequest.getTime()} => ${now - lastRequest.getTime()}`);
  return now - lastRequest.getTime() > 3600000;
}

export const templateTags: Insomnia.TemplateTag[] = [
  {
    name: 'AuthToken',
    displayName: 'Auth Token',
    description: 'Retrieve an auth token from another request',
    args: [
      {
        displayName: 'Request',
        type: 'model',
        model: 'Request'
      }
    ],
    async run(context: Insomnia.Context, requestId) {
      console.log(`Started running with ${context} and ${requestId}`);
      if (!requestId) {
        console.log(`No requestId`);
        throw new Error('No request provided');
      }

      const request = await context.util.models.request.getById(requestId);
      if (!request) {
        console.log(`No request`);
        throw new Error(`Could not find request for requestId: ${requestId}`);
      }

      let response = await context.util.models.response.getLatestForRequestId(requestId);
      const currentValue = await context.store.getItem(`LastRequest-${request._id}`);
      const lastUpdated = new Date(currentValue);
      if (!response || isOutOfDate(lastUpdated)) {
        response = await context.network.sendRequest(request);
        await context.store.setItem(`LastRequest-${request._id}`, new Date().toUTCString());
      }

      const jwt = decodeResponse(context, response);

      if (jwt) {
        if (jwt.access_token) {
          return jwt.access_token;
        }
        if (jwt[0]) {
          return jwt[0]
        }
        console.log(`Unable to find a needed field in jwt`, jwt);
      }
      console.log(`No token found`);
      throw new Error("Failed to extract anything");
    }
  }
];
