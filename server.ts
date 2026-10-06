import { createServer } from "http";
import next from "next";
import { initSocketServer } from "./src/server/socket-server";

const port = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== "production";

// Next 16 wants its own httpServer handed in up front so its internal
// machinery (HMR/Turbopack upgrade handling in dev) attaches correctly —
// creating a bare http.Server and only calling handle(req, res) after the
// fact (the pre-16 pattern) leaves HMR's websocket with nothing to
// upgrade against.
const httpServer = createServer();
const app = next({ dev, httpServer });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  httpServer.on("request", (req, res) => handle(req, res));
  initSocketServer(httpServer);
  httpServer.listen(port, () => {
    console.log(`> Blackjack casino ready on http://localhost:${port}`);
  });
});
