// Turns an exception from fetch()/res.json() into a message a user can act on.
// A rejected fetch (TypeError) means the browser never got a readable response: the backend is
// unreachable, asleep, or the browser blocked it (CORS). A SyntaxError means the response was not
// JSON (for example a gateway page while the server is starting).
export const describeRequestError = (err) => {
  if (err instanceof TypeError) {
    return "Cannot reach the server. Please check your connection and try again in a moment.";
  }
  if (err instanceof SyntaxError) {
    return "The server sent an unexpected response. It may be starting up - please try again in a minute.";
  }
  return "Something went wrong. Please try again.";
};
