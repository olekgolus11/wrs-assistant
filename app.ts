import { serve } from "https://deno.land/std@0.140.0/http/server.ts";

const serverStartTime = performance.now();
const handler = (req: Request): Response => {
  if (req.method === 'GET' && new URL(req.url).pathname === '/') {
    const start = performance.now();

    const arrToSort = Array.from({ length: 1000000 }, () => Math.random());
    arrToSort.sort();

    const response = new Response("Hello from Deno!");

    const timeSpent = performance.now() - start;
    console.log(timeSpent.toFixed(0) + " ms");

    return response;
  } else {
    return new Response("Not Found", { status: 404 });
  }
};

const PORT = 3000;

await serve(handler, { 
  port: PORT,
  onListen: ({ port }) => {
    const serverEndTime = performance.now();
    const startupTime = serverEndTime - serverStartTime;
    console.log(`Deno server started in ${startupTime.toFixed(3)} ms`);
    console.log(`Deno server running on http://localhost:${port}`);
  },
});