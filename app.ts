import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { OpenAI } from "https://esm.sh/@langchain/openai";

const handler = (req: Request): Response => {
  if (req.method === 'GET' && new URL(req.url).pathname === '/') {
    const response = new Response("Hello from Deno!");
    return response;
  } else {
    return new Response("Not Found", { status: 404 });
  }
};

const PORT = 3000;

await serve(handler, { 
  port: PORT,
  onListen: ({ port }) => {
    console.log(`Deno server running on http://localhost:${port}`);
  },
});