const { createServer } = require('http');
const next = require('next');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const isHttps = req.headers['x-forwarded-proto'] === 'https' ||
                      req.connection?.encrypted ||
                      req.socket?.encrypted ||
                      process.env.NODE_ENV === 'production' ||
                      (req.headers.host && !req.headers.host.includes('localhost') && !req.headers.host.includes('127.0.0.1'));
      const proto = isHttps ? 'https' : 'http';
      if (isHttps && !req.headers['x-forwarded-proto']) {
        req.headers['x-forwarded-proto'] = 'https';
      }
      const host = req.headers['x-forwarded-host'] || req.headers.host || `${hostname}:${port}`;
      const parsedUrl = new URL(req.url, `${proto}://${host}`);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port} (mode: ${process.env.NODE_ENV})`);
    });
});
