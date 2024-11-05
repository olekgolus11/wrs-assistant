import { STATUS_CODE } from "jsr:@oak/commons@1/status";
import { Context } from "jsr:@oak/oak";

const getHealthcheck = (ctx: Context) => {
    ctx.response.body = "OK";
    ctx.response.status = STATUS_CODE.OK;
};

export { getHealthcheck };
