import { GraphQLError } from 'graphql/error'

export const TILE_MIGRATING_ERROR_CODE = 'TILE_MIGRATING'

export class TileMigratingError extends GraphQLError {
  constructor() {
    const message = 'This tile is being upgraded. Try again in a few minutes.'
    super(message, {
      extensions: {
        code: TILE_MIGRATING_ERROR_CODE,
        message,
      },
    })
  }
}
