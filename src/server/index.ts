import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8000);
const app = createApp();

app.listen(port, "127.0.0.1", () => {
  console.log(`LifeOS API listening on http://127.0.0.1:${port}`);
});

