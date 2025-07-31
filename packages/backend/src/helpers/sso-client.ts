import { Client, Issuer } from 'openid-client'

import appConfig from '@/config/app'

export interface SsoTokenResponse {
  accessToken: string
  idToken: string
  refreshToken?: string
  sub: string
}

export interface SsoUserInfo {
  sub: string
  email?: string
  [key: string]: any
}

const redirectUri = `${appConfig.webAppUrl}/login/sso/redirect`
export class SsoClient {
  private client: Client | null = null
  private issuer: Issuer<Client> | null = null

  private async getClient(): Promise<Client> {
    if (!this.client) {
      this.issuer = await Issuer.discover(appConfig.sso.discoveryUrl)
      this.client = new this.issuer.Client({
        client_id: appConfig.sso.clientId,
        client_secret: appConfig.sso.clientSecret,
        redirect_uris: [redirectUri],
        response_types: ['code'],
      })
    }
    return this.client
  }

  async callback(params: {
    code: string
    nonce: string
    codeVerifier: string
    state?: string
  }): Promise<SsoTokenResponse> {
    const client = await this.getClient()

    try {
      const tokenSet = await client.callback(
        redirectUri,
        {
          code: params.code,
          iss: this.issuer.metadata.issuer,
        },
        {
          nonce: params.nonce,
          code_verifier: params.codeVerifier,
        },
      )

      return {
        accessToken: tokenSet.access_token,
        idToken: tokenSet.id_token,
        refreshToken: tokenSet.refresh_token,
        sub: tokenSet.claims().sub,
      }
    } catch (e) {
      console.error(e)
      throw e
    }
  }

  async userinfo(params: {
    accessToken: string
    sub: string
  }): Promise<SsoUserInfo> {
    const client = await this.getClient()
    const userinfo = await client.userinfo(params.accessToken)

    return {
      sub: params.sub,
      ...userinfo,
    }
  }

  // async refreshToken(refreshToken: string): Promise<SsoTokenResponse> {
  //   const client = await this.getClient()
  //   const tokenSet = await client.refresh(refreshToken)

  //   return {
  //     accessToken: tokenSet.access_token!,
  //     idToken: tokenSet.id_token!,
  //     refreshToken: tokenSet.refresh_token,
  //     sub: tokenSet.claims().sub,
  //   }
  // }
}

export const ssoClient = new SsoClient()
