import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Port 3000 in development (AI Studio), or process.env.PORT in production deployments
const PORT = process.env.NODE_ENV === 'production' && process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());

// In-memory mesh message queue for inter-device web testing
interface QueuedMeshPacket {
  packet: any;
  senderDeviceId: string;
  serverReceivedAt: number;
}
const meshMessageQueue: QueuedMeshPacket[] = [];

app.post('/api/mesh/message', (req: Request, res: Response) => {
  const { packet, senderDeviceId } = req.body;
  if (packet && packet.messageId) {
    meshMessageQueue.push({
      packet,
      senderDeviceId: senderDeviceId || 'ANON_NODE',
      serverReceivedAt: Date.now(),
    });
    // Keep last 150 packets
    if (meshMessageQueue.length > 150) {
      meshMessageQueue.shift();
    }
    res.json({ success: true, queueLength: meshMessageQueue.length });
    return;
  }
  res.status(400).json({ success: false, error: 'Invalid packet payload' });
});

app.get('/api/mesh/messages', (req: Request, res: Response) => {
  const since = Number(req.query.since) || 0;
  const excludeSender = (req.query.exclude as string) || '';
  const newPackets = meshMessageQueue.filter(
    (item) => item.serverReceivedAt > since && (!excludeSender || item.senderDeviceId !== excludeSender)
  );
  res.json({
    messages: newPackets.map((item) => item.packet),
    serverTime: Date.now(),
  });
});

// Local offline device diagnostic endpoint (100% offline, zero internet or database dependencies)
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    mode: 'STANDALONE_OFFLINE',
    app: 'OFLINK Local Host',
    description: 'Fully offline local communication console. Zero internet, cellular, or cloud database required.',
    uptime: process.uptime(),
    queueSize: meshMessageQueue.length,
    timestamp: new Date().toISOString(),
  });
});

// Vite Integration: Dev middleware or Production static files
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OFLINK Standalone Console] running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
