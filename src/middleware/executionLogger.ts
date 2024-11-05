import { Next } from "jsr:@oak/oak/middleware";
import { Context } from "jsr:@oak/oak/context";

export const executionLogger = async (ctx: Context<Record<string, any>, Record<string, any>>, next: Next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.response.headers.set("X-Response-Time", `${ms}ms`);
    const rt = ctx.response.headers.get("X-Response-Time");
    console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
};
