import 'dotenv/config'
import { writeFileSync } from 'fs'

import Cryptr from 'cryptr'

import { AUTH_FILE_ENCRYPTION_SECRET, AUTH_STATE_FILE } from '../config'

export function login() {
  // Remember to pass the cookie as the argument when running the script!
  const args = process.argv
  const storageState = {
    cookies: [
      {
        name: 'plumber.sid',
        value: args[2],
        domain: 'localhost',
        httpOnly: true,
        secure: false,
        sameSite: 'Strict',
        path: '/',
      },
    ],
  }
  writeFileSync(
    AUTH_STATE_FILE,
    new Cryptr(AUTH_FILE_ENCRYPTION_SECRET).encrypt(
      JSON.stringify(storageState),
    ),
  )
}

login()
