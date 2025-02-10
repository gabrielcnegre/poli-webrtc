import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer } from 'ws';

const __dirname = import.meta.dirname;

const PORT = 3000;
const BASIC_AUTH = process.env.BASIC_AUTH || 'usuario:senha123';

const app = express();

app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    const expectedAuth = 'Basic ' + Buffer.from(BASIC_AUTH).toString('base64');
  
    if (authHeader === expectedAuth) {
      next();
    } else {
      res.set('WWW-Authenticate', 'Basic realm="Área restrita"');
      res.status(401).send('Autenticação requerida.');
    }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/sem-signaling", (req, res) => {
    res.sendFile(path.join(__dirname, "pages", "sem-signaling.html"));
});

app.get("/com-signaling", (req, res) => {
    res.sendFile(path.join(__dirname, "pages", "com-signaling.html"));
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
    console.log("Nova conexão WebSocket");
    ws.on("message", (message) => {
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === ws.OPEN) {
                client.send(message);
            }
        });
    });
    ws.on("close", () => {
        console.log("Conexão WebSocket fechada");
    });
});

server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});


