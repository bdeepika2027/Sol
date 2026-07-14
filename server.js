/*
   Sol - Custom Node.js HTTP Server with local file activity logging.
   Runs offline on port 3000. Serves static files and appends log events.
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const LOG_FILE = path.join(__dirname, 'activity_log.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Handle POST activity log API endpoint
  if (req.method === 'POST' && pathname === '/api/log-activity') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const activity = JSON.parse(body);
        activity.timestamp = activity.timestamp || new Date().toISOString();
        
        let logs = [];
        if (fs.existsSync(LOG_FILE)) {
          try {
            const fileData = fs.readFileSync(LOG_FILE, 'utf8');
            logs = JSON.parse(fileData);
          } catch (e) {
            console.error("Error parsing existing logs, resetting:", e);
          }
        }
        
        logs.push(activity);
        
        // Write back to file formatted with indentation
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: logs.length }));
      } catch (err) {
        console.error("Logger server error:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Failed to log activity to file" }));
      }
    });
    return;
  }
  
  // Static File Server
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  const filePath = path.join(__dirname, pathname);
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': contentType });
    
    const readStream = fs.createReadStream(filePath);
    readStream.on('error', (streamErr) => {
      console.error("Stream error:", streamErr);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
