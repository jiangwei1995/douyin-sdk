/**
* Created by jiangwei on 2020/06/30 .
* Copyright (c) 2020 (jw872505975@gmail.com). All rights reserved.
*/

const rp = require("request-promise");
const Redis = require("ioredis");
class OpenApi {
    constructor(client_key, open_id, redisOption, client_secret, prefix = "dy:openapi", host = "https://open.douyin.com") {
        if (!client_key) {
            throw new Error("client_key cannot be null");
        }
        if (!open_id) {
            throw new Error("open_id cannot be null");
        }
        this.userDataPathMap = {
            item: true,
            fans: true,
            like: true,
            comment: true,
            share: true,
            profile: true
        };
        this.client_key = client_key;
        this.client_secret = client_secret;
        this.open_id = open_id;
        this.host = host;
        this.prefix = `${prefix}:${client_key}`;
        this.open_id_key = `${this.prefix}:${open_id}`;
        this.access_token_key = `${open_id_key}:access_token`;
        this.refresh_token_key = `${open_id_key}:refresh_token`;

        this.redisClient = new Redis(redisOption || {
            port: 6379, // Redis port
            host: "127.0.0.1", // Redis host
            db: 0,
        });
    }
    /**
     * 通过授权码获取access_token
     * @param {*} code 
     */
    async access_token_by_code(code) {
        if (!this.client_secret) {
            throw new Error("client_secret cannot be null")
        }
        if (!code) {
            throw new Error("code cannot be null")
        }
        const options = {
            uri: `${this.host}/oauth/access_token`,
            qs: {
                client_key: this.client_key,
                client_secret: this.client_secret,
                code: code,
                grant_type: "authorization_code"
            },
            json: true
        };
        const body = await rp(options);
        if (body && body.data && body.data.error_code === 0) {
            await this.redisClient.set(this.open_id_key, body.data);
            await this.redisClient.set(this.access_token_key, body.data.access_token, "EX", body.data.expires_in);
            await this.redisClient.set(this.refresh_token_key, body.data.access_token, "EX", body.data.refresh_expires_in);
            return body;
        } else {
            throw new Error(`/oauth/access_token error_code:${body.data.error_code},description:${body.data.description}, 请查看文档: https://open.douyin.com/platform/doc/OpenAPI-oauth2`);
        }
    }
    /**
     * 获取access_token
     */
    async access_token() {
        let access_token = await this.redisClient.get(this.access_token_key);
        if (!access_token) {
            access_token = await this.refresh_access_token();
        };
        return access_token;
    }
    /**
     * 通过refresh_token刷新access_token
     */
    async refresh_access_token() {
        let access_token;
        let refresh_token = await this.redisClient.get(this.refresh_token_key);

        if (!refresh_token) {
            refresh_token = await this.renew_refresh_token();
        }

        const options = {
            uri: `${this.host}/oauth/refresh_token`,
            qs: {
                client_key: this.client_key,
                grant_type: "refresh_token",
                refresh_token: refresh_token
            },
            json: true
        };
        const body = await rp(options);
        if (body && body.data && body.data.error_code === 0) {
            await this.redisClient.set(this.access_token_key, body.data.access_token, "EX", body.data.expires_in);
            access_token = body.data.access_token;
        } else {
            throw new Error(`/oauth/refresh_token error_code:${body.data.error_code},description:${body.data.description}, 请查看文档: https://open.douyin.com/platform/doc/OpenAPI-oauth2`);
        }
        if (!refresh_token) {
            throw new Error(`/oauth/refresh_token error_code:${body.data.error_code},description:${body.data.description}, 请查看文档: https://open.douyin.com/platform/doc/OpenAPI-oauth2`);
        }
        return access_token;
    }
    /**
     * 通过refresh_token刷新refresh_token
     */
    async renew_refresh_token() {
        let refresh_token;
        const data = await this.redisClient.get(this.open_id_key);
        if (data.refresh_token) {
            const options = {
                uri: `${this.host}/oauth/renew_refresh_token`,
                qs: {
                    client_key: this.client_key,
                    refresh_token: refresh_token
                },
                json: true
            };
            const body = await rp(options);
            if (body && body.data && body.data.error_code === 0) {
                await this.redisClient.set(this.refresh_token_key, body.data.refresh_token, "EX", body.data.expires_in);
                const history = await this.redisClient.get(this.open_id_key);
                history.refresh_token = body.data.refresh_token;
                await this.redisClient.set(this.open_id_key, history);
                refresh_token = body.data.refresh_token;
            } else {
                throw new Error(`/oauth/renew_refresh_token error_code:${body.data.error_code},description:${body.data.description}, 请查看文档: https://open.douyin.com/platform/doc/OpenAPI-oauth2`);
            }
            if (!refresh_token) {
                throw new Error(`/oauth/renew_refresh_token error_code:${body.data.error_code},description:${body.data.description}, 请查看文档: https://open.douyin.com/platform/doc/OpenAPI-oauth2`);
            }
            return refresh_token;
        } else {
            throw new Error(`用户还未授权, 请查看文档: https://open.douyin.com/platform/doc/OpenAPI-oauth2`);
        }
    }

    /**
     * 数据开放服务-用户数据-获取用户视频情况
     * @param {number} date_type 近7/15天；输入7代表7天、15代表15天、30代表30天
     * @param {string} open_id  通过/oauth/access_token/获取，用户唯一标志
     * @param {string} access_token 调用/oauth/access_token/生成的token，此token需要用户授权。
     */
    async userDataItem(date_type = 7) {
        return this.userData("item", date_type);
    }
    /**
     * 数据开放服务-用户数据-获取用户粉丝数
     * @param {number} date_type 近7/15天；输入7代表7天、15代表15天、30代表30天
     * @param {string} open_id  通过/oauth/access_token/获取，用户唯一标志
     * @param {string} access_token 调用/oauth/access_token/生成的token，此token需要用户授权。
     */
    async userDataFans(date_type = 7) {
        return this.userData("fans", date_type);
    }

    async userDataLike(date_type = 7) {
        return this.userData("like", date_type);
    }

    async userDataComment(date_type = 7) {
        return this.userData("comment", date_type);
    }

    async userDataShare(date_type = 7) {
        return this.userData("share", date_type);
    }

    async userDataProfile(date_type = 7) {
        return this.userData("profile", date_type);
    }

    /**
     * 数据开放服务-用户数据
     * @param {*} path 
     * @param {*} date_type 
     * @param {*} open_id 
     * @param {*} access_token 
     */
    async userData(path, date_type = 7) {
        if (!this.userDataPathMap[path]) {
            throw new Error(`错误Path, 查看文档 https://open.douyin.com/platform/doc/OpenAPI-external-data-user`);
        };
        const access_token = await this.access_token();
        const options = {
            uri: `${this.host}/data/external/user/${path}`,
            qs: {
                open_id: this.open_id,
                access_token: access_token,
                date_type: date_type,
            },
            method: "GET",
            json: true
        };
        return rp(options);
    }
    /**
     * 视频管理-查询授权账号视频数据
     * @param {*} count 
     * @param {*} cursor 
     * @param {*} open_id 
     * @param {*} access_token 
     */
    async videoList(count = 10, cursor = 0) {
        const access_token = await this.access_token();
        const options = {
            uri: `${this.host}/video/list`,
            qs: {
                open_id: this.open_id,
                access_token: access_token,
                count: count,
                cursor: cursor
            },
            method: "GET",
            json: true
        };
        return rp(options);
    }
}
module.exports = OpenApi;