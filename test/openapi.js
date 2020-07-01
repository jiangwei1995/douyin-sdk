/**
* Created by jiangwei on 2020/06/30 .
* Copyright (c) 2020 (jw872505975@gmail.com). All rights reserved.
*/

const { OpenApi } = require("../");
const assert = require("power-assert");
const client_key = process.env["CLIENT_KEY"];
const client_secret =  process.env["CLIENT_SECRET"];
const openid =  process.env["OPEN_ID"];
const code =  process.env["CODE"];

describe('OpenApi', () => {
    describe('#access_token', () => {
        it('access_token', async () => {
            const openApi = new OpenApi(client_key, openid);
            const access_token = await openApi.access_token()
            assert.ok(typeof access_token === "string", "access_token不是字符串类型");
        });
    });
});